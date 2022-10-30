use hdk::prelude::*;
use logic_integrity::*;
#[hdk_extern]
pub fn create_tag(tag: Tag) -> ExternResult<Record> {
    let tag_hash = create_entry(&EntryTypes::Tag(tag.clone()))?;
    create_link(tag.note_hash.clone(), tag_hash.clone(), LinkTypes::NoteToTag, ())?;
    let record = get(tag_hash.clone(), GetOptions::default())?
        .ok_or(
            wasm_error!(
                WasmErrorInner::Guest(String::from("Could not find the newly created Tag"))
            ),
        )?;
    let path = Path::from("all_tags");
    create_link(path.path_entry_hash()?, tag_hash.clone(), LinkTypes::AllTags, ())?;
    let my_agent_pub_key = agent_info()?.agent_latest_pubkey;
    create_link(my_agent_pub_key, tag_hash.clone(), LinkTypes::AllTagsByAuthor, ())?;
    Ok(record)
}
#[hdk_extern]
pub fn get_tag(action_hash: ActionHash) -> ExternResult<Option<Record>> {
    get(action_hash, GetOptions::default())
}
#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateTagInput {
    original_action_hash: ActionHash,
    updated_tag: Tag,
}
#[hdk_extern]
pub fn update_tag(input: UpdateTagInput) -> ExternResult<Record> {
    let updated_tag_hash = update_entry(input.original_action_hash, &input.updated_tag)?;
    let record = get(updated_tag_hash.clone(), GetOptions::default())?
        .ok_or(
            wasm_error!(
                WasmErrorInner::Guest(String::from("Could not find the newly updated Tag"))
            ),
        )?;
    Ok(record)
}
#[hdk_extern]
pub fn delete_tag(action_hash: ActionHash) -> ExternResult<ActionHash> {
    delete_entry(action_hash)
}
#[hdk_extern]
pub fn get_tag_for_note(note_hash: ActionHash) -> ExternResult<Vec<Record>> {

    let links = get_links(note_hash, LinkTypes::NoteToTag, None)?;
    let get_input: Vec<GetInput> = links
        .into_iter()
        .map(|link| GetInput::new(
            ActionHash::from(link.target).into(),
            GetOptions::default(),
        ))
        .collect();
    let maybe_records = HDK.with(|hdk| hdk.borrow().get(get_input))?;
    let record: Vec<Record> = maybe_records.into_iter().filter_map(|r| r).collect();
    Ok(record)
}

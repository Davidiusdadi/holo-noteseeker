use hdk::prelude::*;
use logic_integrity::*;
#[hdk_extern]
pub fn create_note(note: Note) -> ExternResult<Record> {
    let note_hash = create_entry(&EntryTypes::Note(note.clone()))?;
    let record = get(note_hash.clone(), GetOptions::default())?
        .ok_or(
            wasm_error!(
                WasmErrorInner::Guest(String::from("Could not find the newly created Note"))
            ),
        )?;
    let path = Path::from("all_notes");
    create_link(path.path_entry_hash()?, note_hash.clone(), LinkTypes::AllNotes, ())?;
    Ok(record)
}
#[hdk_extern]
pub fn get_note(action_hash: ActionHash) -> ExternResult<Option<Record>> {
    get(action_hash, GetOptions::default())
}
#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateNoteInput {
    original_action_hash: ActionHash,
    updated_note: Note,
}
#[hdk_extern]
pub fn update_note(input: UpdateNoteInput) -> ExternResult<Record> {
    let updated_note_hash = update_entry(
        input.original_action_hash,
        &input.updated_note,
    )?;
    let record = get(updated_note_hash.clone(), GetOptions::default())?
        .ok_or(
            wasm_error!(
                WasmErrorInner::Guest(String::from("Could not find the newly updated Note"))
            ),
        )?;
    Ok(record)
}
#[hdk_extern]
pub fn delete_note(action_hash: ActionHash) -> ExternResult<ActionHash> {
    delete_entry(action_hash)
}

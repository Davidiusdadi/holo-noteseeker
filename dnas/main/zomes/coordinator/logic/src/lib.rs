pub mod all_notes_by_author;
pub mod all_tags_by_author;
pub mod all_tags;
pub mod tag;
pub mod all_notes;
pub mod note;
use hdk::prelude::*;
#[hdk_extern]
pub fn init(_: ()) -> ExternResult<InitCallbackResult> {
    Ok(InitCallbackResult::Pass)
}

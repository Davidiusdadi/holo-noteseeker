use hdi::prelude::*;
#[hdk_entry_helper]
#[derive(Clone)]
pub struct Tag {
    pub note_hash: ActionHash,
}

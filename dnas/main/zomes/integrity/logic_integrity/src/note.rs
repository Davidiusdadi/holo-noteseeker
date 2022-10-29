use hdi::prelude::*;
#[hdk_entry_helper]
#[derive(Clone)]
pub struct Note {
    pub text: String,
}

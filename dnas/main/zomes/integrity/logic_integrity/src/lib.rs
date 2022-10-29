pub mod note;
pub use note::*;
use hdi::prelude::*;
#[hdk_extern]
pub fn validate(_op: Op) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
#[hdk_entry_defs]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    Note(Note),
}
#[hdk_link_types]
pub enum LinkTypes {
    AllNotes,
}

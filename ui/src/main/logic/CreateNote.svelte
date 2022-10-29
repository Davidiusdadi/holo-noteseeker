<script lang="ts">
import { createEventDispatcher, getContext } from 'svelte';
import { InstalledCell, AppWebsocket, InstalledAppInfo } from '@holochain/client';
import { appWebsocketContext, appInfoContext } from '../../contexts';
import { Note } from './note';
import '@material/mwc-button';
import '@material/mwc-textarea';

let appInfo = getContext(appInfoContext).getAppInfo();
let appWebsocket = getContext(appWebsocketContext).getAppWebsocket();

const dispatch = createEventDispatcher();

let text: string
 | undefined;

$: text;

async function createNote() {
  const cellData = appInfo.cell_data.find((c: InstalledCell) => c.role_id === 'main')!;
  const note: Note = { 
    text: text!,
  };
  
  const record: Record = await appWebsocket.callZome({
    cap_secret: null,
    cell_id: cellData.cell_id,
    zome_name: 'logic',
    fn_name: 'create_note',
    payload: note,
    provenance: cellData.cell_id[1]
  });
  dispatch('note-created', { actionHash: record.signed_action.hashed.hash });
}
</script>
<div style="display: flex; flex-direction: column">
  <span style="font-size: 18px">Create Note</span>
  
    <mwc-textarea outlined label="" on:input="{e => this._text = e.target.value}"></mwc-textarea>

  <mwc-button 
    label="Create Note"
    disabled={!( text )}
    on:click="{() => createNote()}"
  ></mwc-button>
</div>

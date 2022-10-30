<script lang="ts">
import { createEventDispatcher, getContext } from 'svelte';
import { InstalledCell, AppWebsocket, InstalledAppInfo } from '@holochain/client';
import { appWebsocketContext, appInfoContext } from '../../contexts';
import { Tag } from './tag';
import '@material/mwc-button';

let appInfo = getContext(appInfoContext).getAppInfo();
let appWebsocket = getContext(appWebsocketContext).getAppWebsocket();

const dispatch = createEventDispatcher();

let noteHash: ActionHash
 | undefined;

$: noteHash;

async function createTag() {
  const cellData = appInfo.cell_data.find((c: InstalledCell) => c.role_id === 'main')!;
  const tag: Tag = { 
    note_hash: noteHash!,
  };
  
  const record: Record = await appWebsocket.callZome({
    cap_secret: null,
    cell_id: cellData.cell_id,
    zome_name: 'logic',
    fn_name: 'create_tag',
    payload: tag,
    provenance: cellData.cell_id[1]
  });
  dispatch('tag-created', { actionHash: record.signed_action.hashed.hash });
}
</script>
<div style="display: flex; flex-direction: column">
  <span style="font-size: 18px">Create Tag</span>
  
    <!-- TODO: implement the creation of note_hash -->

  <mwc-button 
    label="Create Tag"
    disabled={!( noteHash )}
    on:click="{() => createTag()}"
  ></mwc-button>
</div>

<script lang="ts">
import { onMount, getContext } from 'svelte';
import '@material/mwc-circular-progress';
import { decode } from '@msgpack/msgpack';
import { InstalledCell, Record, AgentPubKey, ActionHash, AppWebsocket, InstalledAppInfo } from '@holochain/client';
import { appInfoContext, appWebsocketContext } from '../../contexts';
import TagDetail from './TagDetail.svelte';


let appInfo = getContext(appInfoContext).getAppInfo();
let appWebsocket = getContext(appWebsocketContext).getAppWebsocket();

let records: Array<Record> | undefined;
$: records;

onMount(async () => {
  const cellData = appInfo.cell_data.find((c: InstalledCell) => c.role_id === 'main')!;

  records = await appWebsocket.callZome({
    cap_secret: null,
    cell_id: cellData.cell_id,
    zome_name: 'logic',
    fn_name: 'get_all_tags',
    payload: null,
    provenance: cellData.cell_id[1]
  });
});

</script>

{#if records }
  <div style="display: flex; flex-direction: column">
    {#each records as record}
      <TagDetail actionHash={record.signed_action.hashed.hash} style="margin-bottom: 8px;"></TagDetail>
    {/each}
  </div>
{:else}
  <div style="display: flex; flex: 1; align-items: center; justify-content: center">
    <mwc-circular-progress indeterminate></mwc-circular-progress>
  </div>
{/if}

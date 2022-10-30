<script lang="ts">
import { onMount, getContext } from 'svelte';
import '@material/mwc-circular-progress';
import { decode } from '@msgpack/msgpack';
import { InstalledCell, Record, ActionHash, AppWebsocket, InstalledAppInfo } from '@holochain/client';
import { appInfoContext, appWebsocketContext } from '../../contexts';
import { Tag } from './tag';

export let actionHash: ActionHash;

let appInfo = getContext(appInfoContext).getAppInfo();
let appWebsocket = getContext(appWebsocketContext).getAppWebsocket();

let tag: Tag | undefined;
$: tag;

onMount(async () => {
  const cellData = appInfo.cell_data.find((c: InstalledCell) => c.role_id === 'main')!;

  const record: Record | undefined = await appWebsocket.callZome({
    cap_secret: null,
    cell_id: cellData.cell_id,
    zome_name: 'logic',
    fn_name: 'get_tag',
    payload: actionHash,
    provenance: cellData.cell_id[1]
  });
  if (record) {
    tag = decode((record.entry as any).Present.entry) as Tag;
  }
});

</script>

{#if tag }
  <div style="display: flex; flex-direction: column">
    <span style="font-size: 18px">Tag</span>
	    </div>
{:else}
  <div style="display: flex; flex: 1; align-items: center; justify-content: center">
    <mwc-circular-progress indeterminate></mwc-circular-progress>
  </div>
{/if}

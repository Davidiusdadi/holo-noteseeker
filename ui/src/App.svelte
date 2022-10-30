<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { AppWebsocket, ActionHash, InstalledAppInfo } from '@holochain/client';
  import '@material/mwc-circular-progress';
  import { Router, Route, Link } from "svelte-navigator";

  import { appWebsocketContext, appInfoContext } from './contexts';
  import CreateNote from "./main/logic/CreateNote.svelte"
  import AllNotes from "./main/logic/AllNotes.svelte"

  let appWebsocket: AppWebsocket | undefined;
  let appInfo: InstalledAppInfo | undefined;
  let loading = true;
  let actionHash: ActionHash | undefined;

  $: appWebsocket, appInfo, actionHash, loading;

  onMount(async () => {
    appWebsocket = await AppWebsocket.connect(`ws://localhost:${process.env.HC_PORT}`);

    appInfo = await appWebsocket.appInfo({
      installed_app_id: 'holo-noteseeker',
    });
    loading = false;
  });

  setContext(appWebsocketContext, {
    getAppWebsocket: () => appWebsocket,
  });

  setContext(appInfoContext, {
    getAppInfo: () => appInfo,
  });
</script>

<main>
  {#if loading}
    <div style="display: flex; flex: 1; align-items: center; justify-content: center">
      <mwc-circular-progress indeterminate />
    </div>
  {:else}
    <div id="content" >

      <Router>
        <header>
          <h1>NoteSeeker</h1>
          <nav>
            <Link to="*">Home</Link>
            <Link to="/new-note">New Note</Link>
            <Link to="/all-notes">All Notes</Link>
          </nav>
        </header>
        <Route path="/new-note" component={CreateNote} />
        <Route path="/all-notes" component={AllNotes} />
        <Route path="/*"> Main </Route>
      </Router>

    </div>
  {/if}
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style>


import test from 'node:test';
import assert from 'node:assert';

import { runScenario, pause } from '@holochain/tryorama';
import { ActionHash, Record } from '@holochain/client';
import { decode } from '@msgpack/msgpack';


test('create note', async t => {
  await runScenario(async scenario => {

    // Construct proper paths for your app.
    // This assumes app bundle created by the `hc app pack` command.
    const testAppPath = process.cwd() + '/' + "../workdir/holo-noteseeker.happ";

    // Set up the array of DNAs to be installed, which only consists of the
    // test DNA referenced by path.
    const app = { appBundleSource: { path: testAppPath } };

    // Add 2 players with the test DNA to the Scenario. The returned players
    // can be destructured.
    const [alice, bob] = await scenario.addPlayersWithHappBundles([app, app]);

    // Shortcut peer discovery through gossip and register all agents in every
    // conductor of the scenario.
    await scenario.shareAllAgents();
    
    const alice_main_cell = alice.cells.find(c => c.role_id === 'main');
    if (!alice_main_cell) throw new Error("No cell for role id main was found");

    const bob_main_cell = bob.cells.find(c => c.role_id === 'main');
    if (!bob_main_cell) throw new Error("No cell for role id main was found");
    


    const createInput = {
  text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.'
};

    // Alice creates a note
    const record: Record = await alice_main_cell.callZome({
      zome_name: "logic",
      fn_name: "create_note",
      payload: createInput,
    });
    assert.ok(record);

  });
});

test('create and read note', async t => {
  await runScenario(async scenario => {

    // Construct proper paths for your app.
    // This assumes app bundle created by the `hc app pack` command.
    const testAppPath = process.cwd() + '/' + "../workdir/holo-noteseeker.happ";

    // Set up the array of DNAs to be installed, which only consists of the
    // test DNA referenced by path.
    const app = { appBundleSource: { path: testAppPath } };

    // Add 2 players with the test DNA to the Scenario. The returned players
    // can be destructured.
    const [alice, bob] = await scenario.addPlayersWithHappBundles([app, app]);

    // Shortcut peer discovery through gossip and register all agents in every
    // conductor of the scenario.
    await scenario.shareAllAgents();
    
    const alice_main_cell = alice.cells.find(c => c.role_id === 'main');
    if (!alice_main_cell) throw new Error("No cell for role id main was found");

    const bob_main_cell = bob.cells.find(c => c.role_id === 'main');
    if (!bob_main_cell) throw new Error("No cell for role id main was found");
    

    const createInput: any = {
  text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.'
};

    // Alice creates a note
    const record: Record = await alice_main_cell.callZome({
      zome_name: "logic",
      fn_name: "create_note",
      payload: createInput,
    });
    assert.ok(record);
    
    // Wait for the created entry to be propagated to the other node.
    await pause(300);

    // Bob gets the created note
    const createReadOutput: Record = await bob_main_cell.callZome({
      zome_name: "logic",
      fn_name: "get_note",
      payload: record.signed_action.hashed.hash,
    });
    assert.deepEqual(createInput, decode((createReadOutput.entry as any).Present.entry) as any);
  });
});
test('create and update note', async t => {
  await runScenario(async scenario => {

    // Construct proper paths for your app.
    // This assumes app bundle created by the `hc app pack` command.
    const testAppPath = process.cwd() + '/' + "../workdir/holo-noteseeker.happ";

    // Set up the array of DNAs to be installed, which only consists of the
    // test DNA referenced by path.
    const app = { appBundleSource: { path: testAppPath } };

    // Add 2 players with the test DNA to the Scenario. The returned players
    // can be destructured.
    const [alice, bob] = await scenario.addPlayersWithHappBundles([app, app]);

    // Shortcut peer discovery through gossip and register all agents in every
    // conductor of the scenario.
    await scenario.shareAllAgents();
    
    const alice_main_cell = alice.cells.find(c => c.role_id === 'main');
    if (!alice_main_cell) throw new Error("No cell for role id main was found");

    const bob_main_cell = bob.cells.find(c => c.role_id === 'main');
    if (!bob_main_cell) throw new Error("No cell for role id main was found");
    

    const createInput = {
  text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.'
};

    // Alice creates a note
    const record: Record = await alice_main_cell.callZome({
      zome_name: "logic",
      fn_name: "create_note",
      payload: createInput,
    });
    assert.ok(record);
 
    // Alice updates the note
    const contentUpdate: any = {
  text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.'
};

    const updateInput = {
      original_action_hash: record.signed_action.hashed.hash,
      updated_note: contentUpdate,
    };

    const updatedRecord: Record = await alice_main_cell.callZome({
      zome_name: "logic",
      fn_name: "update_note",
      payload: updateInput,
    });
    assert.ok(updatedRecord);


    // Wait for the updated entry to be propagated to the other node.
    await pause(300);
        
    // Bob gets the updated note
    const readUpdatedOutput: Record = await bob_main_cell.callZome({
      zome_name: "logic",
      fn_name: "get_note",
      payload: updatedRecord.signed_action.hashed.hash,
    });
    assert.deepEqual(contentUpdate, decode((readUpdatedOutput.entry as any).Present.entry) as any);

  });
});
test('create and delete note', async t => {
  await runScenario(async scenario => {

    // Construct proper paths for your app.
    // This assumes app bundle created by the `hc app pack` command.
    const testAppPath = process.cwd() + '/' + "../workdir/holo-noteseeker.happ";

    // Set up the array of DNAs to be installed, which only consists of the
    // test DNA referenced by path.
    const app = { appBundleSource: { path: testAppPath } };

    // Add 2 players with the test DNA to the Scenario. The returned players
    // can be destructured.
    const [alice, bob] = await scenario.addPlayersWithHappBundles([app, app]);

    // Shortcut peer discovery through gossip and register all agents in every
    // conductor of the scenario.
    await scenario.shareAllAgents();
    
    const alice_main_cell = alice.cells.find(c => c.role_id === 'main');
    if (!alice_main_cell) throw new Error("No cell for role id main was found");

    const bob_main_cell = bob.cells.find(c => c.role_id === 'main');
    if (!bob_main_cell) throw new Error("No cell for role id main was found");
    

    const createInput = {
  text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.'
};

    // Alice creates a note
    const record: Record = await alice_main_cell.callZome({
      zome_name: "logic",
      fn_name: "create_note",
      payload: createInput,
    });
    assert.ok(record);
        
    // Alice deletes the note
    const deleteActionHash = await alice_main_cell.callZome({
      zome_name: "logic",
      fn_name: "delete_note",
      payload: record.signed_action.hashed.hash,
    });
    assert.ok(deleteActionHash);


    // Wait for the entry deletion to be propagated to the other node.
    await pause(300);
        
    // Bob tries to get the deleted note
    const readDeletedOutput = await bob_main_cell.callZome({
      zome_name: "logic",
      fn_name: "get_note",
      payload: record.signed_action.hashed.hash,
    });
    assert.equal(readDeletedOutput, undefined);

  });
});
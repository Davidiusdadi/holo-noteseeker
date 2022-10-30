
import test from 'node:test';
import assert from 'node:assert';

import { runScenario, pause } from '@holochain/tryorama';
import { ActionHash, Record } from '@holochain/client';
import { decode } from '@msgpack/msgpack';


test('create tag', async t => {
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
  note_hash: Buffer.from(new Uint8Array([132, 41, 36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
};

    // Alice creates a tag
    const record: Record = await alice_main_cell.callZome({
      zome_name: "logic",
      fn_name: "create_tag",
      payload: createInput,
    });
    assert.ok(record);

  });
});

test('create and read tag', async t => {
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
  note_hash: Buffer.from(new Uint8Array([132, 41, 36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
};

    // Alice creates a tag
    const record: Record = await alice_main_cell.callZome({
      zome_name: "logic",
      fn_name: "create_tag",
      payload: createInput,
    });
    assert.ok(record);
    
    // Wait for the created entry to be propagated to the other node.
    await pause(300);

    // Bob gets the created tag
    const createReadOutput: Record = await bob_main_cell.callZome({
      zome_name: "logic",
      fn_name: "get_tag",
      payload: record.signed_action.hashed.hash,
    });
    assert.deepEqual(createInput, decode((createReadOutput.entry as any).Present.entry) as any);
  });
});
test('create and update tag', async t => {
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
  note_hash: Buffer.from(new Uint8Array([132, 41, 36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
};

    // Alice creates a tag
    const record: Record = await alice_main_cell.callZome({
      zome_name: "logic",
      fn_name: "create_tag",
      payload: createInput,
    });
    assert.ok(record);
 
    // Alice updates the tag
    const contentUpdate: any = {
  note_hash: Buffer.from(new Uint8Array([132, 41, 36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
};

    const updateInput = {
      original_action_hash: record.signed_action.hashed.hash,
      updated_tag: contentUpdate,
    };

    const updatedRecord: Record = await alice_main_cell.callZome({
      zome_name: "logic",
      fn_name: "update_tag",
      payload: updateInput,
    });
    assert.ok(updatedRecord);


    // Wait for the updated entry to be propagated to the other node.
    await pause(300);
        
    // Bob gets the updated tag
    const readUpdatedOutput: Record = await bob_main_cell.callZome({
      zome_name: "logic",
      fn_name: "get_tag",
      payload: updatedRecord.signed_action.hashed.hash,
    });
    assert.deepEqual(contentUpdate, decode((readUpdatedOutput.entry as any).Present.entry) as any);

  });
});
test('create and delete tag', async t => {
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
  note_hash: Buffer.from(new Uint8Array([132, 41, 36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
};

    // Alice creates a tag
    const record: Record = await alice_main_cell.callZome({
      zome_name: "logic",
      fn_name: "create_tag",
      payload: createInput,
    });
    assert.ok(record);
        
    // Alice deletes the tag
    const deleteActionHash = await alice_main_cell.callZome({
      zome_name: "logic",
      fn_name: "delete_tag",
      payload: record.signed_action.hashed.hash,
    });
    assert.ok(deleteActionHash);


    // Wait for the entry deletion to be propagated to the other node.
    await pause(300);
        
    // Bob tries to get the deleted tag
    const readDeletedOutput = await bob_main_cell.callZome({
      zome_name: "logic",
      fn_name: "get_tag",
      payload: record.signed_action.hashed.hash,
    });
    assert.equal(readDeletedOutput, undefined);

  });
});
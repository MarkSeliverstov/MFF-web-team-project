<script lang='ts'>
    import type { WebsiteRecord, Periodicity } from '$lib/types';
    import RecordModal from "./RecordModal.svelte";
    import {allRecordsStore, allExecutionsStore, livePreview, batchIndexStore, websiteGraphData, domainGraphData, websiteNodes, websiteEdges, domainEdges, domainNodes} from '$lib/graphDataStore'; 
    export let node : any;
    export let onClose : any;
    let showModal = false;
    let newWebsiteRecord = {
        url: node.id,
        periodicity: {
			minutes: 0,
			hours: 0,
			days: 0,
        } as Periodicity,
        regexp: "",
        label: "",
        active: false,
        tags: [],
        latestGroupId: 0,
    } as WebsiteRecord;

    let recordsToShow : WebsiteRecord[] = [];
    let waitingForCrawler = false;

    // compute records from which this node's url has been crawled    
    if (node.status === "success" || node.status === "failed") { // only for crawled nodes        
        
        let uniqueRecordIds = new Set<string>();
    
        for (const execution of $allExecutionsStore) {
            if (execution.url === node.id) {uniqueRecordIds.add(execution.ownerId.toString());}
        } 
        for (const record of $allRecordsStore) {
            if (uniqueRecordIds.has(record.id!.toString())) {
                recordsToShow.push(record);
            }
        }           
    }
</script>

<div id="nodeDetail">
    <button on:click={onClose} class="view-buttons">X</button>    
    <h5>{node.id}</h5>

    {#if node.status} 
        {#if (node.status === "success" || node.status === "failed")}
            <h5>Status: {node.status}</h5>
            <h5>Crawl time: {(node.crawlTimeEnd-node.crawlTimeStart).toString()} seconds</h5>
            <h5>Website records that crawled this node:</h5>            
            <ul id="nodeDetailRecords">
                {#each recordsToShow as websiteRecord}
                    <li class="website-record-li">
                        <div class="fields-container">
                            <h2 class="li-label">{websiteRecord.label}</h2>
                            <p class="li-fields li-url"><b>URL:</b> {websiteRecord.url}</p>
                            
                        </div>

                        <button
						on:click={async () => { 
								waitingForCrawler = true;
								let method = "start";
								if(websiteRecord.lastExecution) {
									if(websiteRecord.lastExecution.status === "running") {
										method = "abort";
									}
                                    else {
                                        livePreview.update(() => true);
                                    }
								}
								else {
									method = "start"
                                    livePreview.update(() => true);
								}
								await fetch(`http://localhost:5000/api/crawler/${method}/${websiteRecord.id}`);	
                                const request = await fetch(`/api/executions?ownerId=${websiteRecord.id}&groupId=${websiteRecord.latestGroupId+1}`);
                                await new Promise(resolve => setTimeout(resolve, 2000))	
						        const lastExecutions = await request.json();
                                const exe = lastExecutions.find((exe) => exe.root==true);

                                websiteRecord.lastExecution = exe
                                websiteRecord.latestGroupId++;
								waitingForCrawler = false;
                                batchIndexStore.set(0);     
                                websiteEdges.update((array) => {
                                    array = [];
                                    return array;
                                });
                                domainEdges.update((set) => {
                                    set.clear();
                                    return set;
                                });
                                domainNodes.update((map) => {
                                    map.clear();
                                    return map;
                                });
                                websiteGraphData.update((object) => {
                                    object.nodes = [];
                                    object.edges = [];
                                    return object;
                                });
                                websiteNodes.update((map) => {
                                    map.clear();
                                    return map;
                                });
                                $domainGraphData = {
                                    nodes: [],
                                    edges: []
                                }                     
							}}
						class="start-crawling-button view-buttons">
						{#if (waitingForCrawler)}
							<span class="loading-spinner" />
						{:else}
                            {#if (websiteRecord)}
                                {#if (websiteRecord.lastExecution.status === "running")}
                                    Stop crawling
                                {:else}
                                    Start crawling
                                {/if}    
                            {/if}                       
						{/if}
						</button>
                    </li>
                {/each}
            </ul>
        {:else}
            <!-- for non-crawled nodes, show only URL and create record button-->
            <!-- TODO: in the create record modal, make the url fixed/non-changeable-->
            <button on:click={() => showModal = true} class="view-buttons">Add record</button>
            {#if showModal}
                <RecordModal bind:showModal bind:websiteRecord={newWebsiteRecord} create={true} />
            {/if}
        {/if}           
    {/if}
</div>

<style>
   
    .website-record-li {

		display: flex;
		flex-direction: row;
		justify-content: space-around;
		align-items: center;
		padding: 5px;
        margin-top: 5px;
		margin-bottom: 5px;
		border-style: solid;
		border-width: medium;
		border-color: black;
		border-radius: 5px;		
	}    
    #nodeDetail {
            position: fixed;
            z-index: 100;
            right: 0;
            top: 0;
            height: 100vh;
            width: 30vw;
            background-color: beige;
            border: medium solid black;
            padding: 10px;    
            border-radius: 5px;               
        }
        #nodeDetail ul {
            overflow: scroll;
            height: 50vh;
            width: 95%;
            border: thin solid black;
            border-radius: 5px;
            background-color: whitesmoke;
            padding: 10px;
            list-style-type: none;
    }
    
    #nodeDetail li {
        margin-top: 10px;
        margin-bottom: 10px;

    }

    .view-buttons {
		border: solid medium black;
		border-radius: 5px;
		padding: 10px;
		background-color: beige;
		font-size: medium;
		font-weight: bold;
	}
    .view-buttons:hover {
        background-color: bisque;
	}
</style>
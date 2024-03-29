<script lang="ts">
	import { paginate, LightPaginationNav } from 'svelte-paginate';
	import type { Execution, WebsiteRecord } from '$lib/types';
	import type { PageData } from './$types';
	import SearchBar from '$components/SearchBar.svelte';
	import NoResults from '$components/NoResults.svelte';
	import RecordModal from '$components/RecordModal.svelte';
	import ExecutionModal from '$components/ExecutionModal.svelte';
	import VisualizationModal from '$components/VisualizationModal.svelte';
	import { invalidateAll } from '$app/navigation';
	import { executionsStore, allExecutionsStore, allRecordsStore, activeSelectionStore } from '$lib/graphDataStore';

	export let data: PageData;

	let CrawlerWaitingId: number | null = null;
	
	let showModal = false;
	let websiteRecordToEdit: WebsiteRecord | null = null;
	$: if (!showModal) {
		websiteRecordToEdit = null;
	}

	let showVisualization = false;

	let paginatedItems: any;
	let currentPage = 1;
	let pageSize = 10;

	// fetch data from db (but most of it is stored in svelte stores in graphDataStore.ts)
	$: ({lastExecutionsMap} = data);

	
	// shallow copy of record array fetched from db; is filtered by search bar
	let shownRecords: WebsiteRecord[];
	$: (shownRecords = [...$allRecordsStore]), searchRecords(), sortRecords();

	let searchTerm = '';
	let searchMethods: string[] = [];
	let searchPlaceholder = '';

	let sortBy = 'URL';	

	// reactively sort records after change of sort by
	$: sortBy, sortRecords();

	//reactively search and change the search bar when search methods change
	$: {
		if (!searchMethods.length) {
			searchPlaceholder = 'Select criteria to filter by';
			searchTerm = '';
		} else {
			searchPlaceholder = 'Filter by ' + searchMethods.join(', ');
		}
		searchRecords();
		sortRecords();
	}

	// search function
	const searchRecords = () => {
		return (shownRecords = ($allRecordsStore as WebsiteRecord[]).filter((record) => {
			// if no filter criteria are selected, show all records
			if (!searchMethods.length) {
				return true;
			} else {
				//defaults to true as criteria not influencing the search should not exclude results
				let urlMatch = false;
				let labelMatch = false;
				let tagsMatch = false;

				let searchTermLowered = searchTerm.toLowerCase();

				if (searchMethods.includes('URL')) {
					// prevent insignificant parts of url to be included in search
					let urlSource = new URL(record.url.toLowerCase());
					let url = urlSource.hostname + urlSource.pathname;

					urlMatch = url.includes(searchTermLowered);
				}

				if (searchMethods.includes('Label')) {
					let label = record.label.toLowerCase();

					labelMatch = label.includes(searchTermLowered);
				}

				if (searchMethods.includes('Tags')) {
					let tags = record.tags.filter((tag) => tag.toLowerCase()).join(' ');

					tagsMatch = tags.includes(searchTermLowered);
				}

				return urlMatch || labelMatch || tagsMatch;
			}
		}));
	};

	//sort function
	function sortRecords() {
		if (sortBy === 'URL') {
			return (shownRecords = shownRecords.sort((a, b) => {
				let aSource = new URL(a.url.toLowerCase());
				let aUrl = aSource.hostname + aSource.pathname;

				let bSource = new URL(b.url.toLowerCase());
				let bUrl = bSource.hostname + bSource.pathname;
				return aUrl < bUrl ? -1 : aUrl > bUrl ? 1 : 0;
			}));
		}

		if (sortBy === 'LastCrawl') {
			return (shownRecords = shownRecords.sort((a, b) => {
				if (a.lastExecution && b.lastExecution) {
					if (a.lastExecution.status === "success" && b.lastExecution.status === "success") {
						return b.lastExecution.crawlTimeEnd - a.lastExecution.crawlTimeEnd;
					}
					else if (a.lastExecution.status != "success") {
						return 1;
					}
					else if (b.lastExecution.status != "success") {
						return -1;
					}
					else {
						return 0;
					}
				}
				else if (!a.lastExecution) {
					return -1;
				}
				else {
					return 1;
				}				
			}))		
		}

		throw new Error('Error: cannot sort by' + sortBy);
	}	
	
	// refresh view function + state bool (true if loading new data)
	let refreshing: boolean = false;
	async function refreshRecords() {
		refreshing = true;
		await invalidateAll();
		refreshing = false;
	}	

	let showExecutions = false;
	let showExecutionsForRecord = false;
	//let allExecutionsStore : Execution[] = [];

	let executionParentRecord : WebsiteRecord | null = null; // passed to a record-specific execution showing
	
	function filterExecutionsForRecord() {
		return $allExecutionsStore.filter((execution) => {
			 return execution.ownerId === executionParentRecord!.id;
		})
	}	

	// contains ids of records in active selection; passed to visualization
	let activeSelection : WebsiteRecord[] = [];
	
	function returnActiveExecutions() {
		let activeExecutions : Execution[] = [];
		for(const record of activeSelection) {
			if(lastExecutionsMap.has(record.id!.toString())) {
				activeExecutions = [...activeExecutions , ...lastExecutionsMap.get(record.id)];
			}
		}
		executionsStore.set(activeExecutions);
	}

	function returnRootExecutions() {
		return activeSelection.map((record) => record.lastExecution)
	}

	$: paginatedItems = paginate({ items: shownRecords, pageSize, currentPage });
</script>

<nav class="list-view-nav">
	<div class="search-bar">
		<SearchBar
			placeholder={searchPlaceholder}
			bind:searchMethods
			bind:searchTerm
			bind:sortBy
			on:input={searchRecords}
		/>
		<button
			on:click={async () => {
				showExecutions = true;}}
			class="view-buttons show-all-executions-button"
		>		
			Show all executions
		</button>

		<button
			on:click={async () => {
				await refreshRecords();
			}}
			class="view-buttons refresh-button"
		>
			{#if refreshing}
				<span class="loading-spinner" />
			{:else}
				Refresh
			{/if}
		</button>
	</div>
</nav>

<body>
	{#if searchTerm && shownRecords.length === 0}
		<div class="no-results-wrapper">
			<NoResults />
		</div>
	{:else}
		<ul class="website-record-list">
			{#each paginatedItems as websiteRecord}
				<li class="website-record-li">
					<div class="fields-container">
						<h2 class="li-label">{websiteRecord.label}</h2>
						<p class="li-fields li-url"><b>URL:</b> {websiteRecord.url}</p>
						<p class="li-fields li-periodicity">
							<b>Periodicity:</b>
							{#if websiteRecord.periodicity != null}
								every
								{websiteRecord.periodicity.days} days,
								{websiteRecord.periodicity.hours} hours,
								{websiteRecord.periodicity.minutes} minutes
							{:else}
								No period set
							{/if}
						</p>
						<p class="li-fields li-regex"><b>Regex:</b> {websiteRecord.regexp}</p>
						<p class="li-fields li-active"><b>Active:</b> {websiteRecord.active ? 'Yes' : 'No'}</p>

						<ul class="li-fields li-tags">
							<b>Tags:</b>
							{#each websiteRecord.tags as tag}
								<li>
									{tag}
								</li>
							{/each}
						</ul>

						{#if (websiteRecord.lastExecution)}
							<p class="li-fields"><b>Latest execution status:</b> {websiteRecord.lastExecution.status}</p>							
							<p class="li-fields"><b>Latest execution date:</b> 
								{#if (websiteRecord.lastExecution.status === "running")}
									Not finished yet
								{:else}	
									{new Date(websiteRecord.lastExecution.crawlTimeEnd).toLocaleString("en-GB")}
								{/if}
							</p>
						{/if}
					</div>
					
					<div class="record-buttons-container">
						{#if (websiteRecord.lastExecution)}
						<button class="view-buttons {websiteRecord.checked ? "selected" : "unselected"}" on:click={() => {
								websiteRecord.checked = !websiteRecord.checked;
								if (websiteRecord.checked && activeSelection.indexOf(websiteRecord) === -1) {
									activeSelection.push(websiteRecord);
								}
								else {
									activeSelection = activeSelection.filter((record) => record.id != websiteRecord.id);
								}								
							}}							
							>
							{#if (websiteRecord.checked)}
								Unselect
							{:else}
								Select
							{/if}
						</button>
						{/if}
						
						<button
						on:click={async () => { 
								CrawlerWaitingId = websiteRecord.id
								let method = "start";
								if(websiteRecord.lastExecution) {
									if(websiteRecord.lastExecution.status === "running") {
										method = "abort";
									}
								}
								else {
									method = "start";
								}
								await fetch(`http://localhost:5000/api/crawler/${method}/${websiteRecord.id}`);
								await new Promise(resolve => setTimeout(resolve, 1000))
								await refreshRecords()
								CrawlerWaitingId = null
							}}
						class="start-crawling-button view-buttons">
						{#if (websiteRecord.id == CrawlerWaitingId)}
							<span class="loading-spinner" />
						{:else}
							{#if (websiteRecord.lastExecution)}
								{#if (websiteRecord.lastExecution.status === "running")}
									Stop crawling
								{:else}
									Start crawling
								{/if}
							{:else}
								Start crawling
							{/if}
						{/if}
						</button>
						
						<button class="show-executions-button view-buttons"
						on:click={ async () => {	
							executionParentRecord = websiteRecord;
							showExecutionsForRecord = true;
						}}>
							Show executions
						</button>
						
						<button
							on:click={() => {
								websiteRecordToEdit = websiteRecord;
								showModal = true;
							}}
							class="edit-record-button view-buttons">Edit						
						</button>

						<button 
							on:click={async () => {
								// delete the record from db
								await fetch(`http://localhost:3000/api/record/${websiteRecord.id}`, {
									method: "DELETE"
								});

								// delete all executions that belong to the record from db
								await fetch(`http://localhost:3000/api/executions/${websiteRecord.id}`, {
									method: "DELETE"
								})

								// make the change appear before fetching new data from db
								allRecordsStore.set($allRecordsStore.filter((record) => record != websiteRecord));
								allExecutionsStore.set($allExecutionsStore.filter((execution) => execution.ownerId != websiteRecord.id));
							}}
							class="view-buttons">Delete
						</button>
					</div>					
				</li>
			{/each}
		</ul>
	{/if}

	{#if (showExecutionsForRecord)}
		<ExecutionModal bind:showModal={showExecutionsForRecord} executions={filterExecutionsForRecord()} record={executionParentRecord} />
	{/if}

	{#if showExecutions}
		<ExecutionModal bind:showModal={showExecutions} executions={$allExecutionsStore}/>
	{/if}

	{#if showModal && websiteRecordToEdit === null}
		<RecordModal bind:showModal create={true}/>
	{:else if showModal && websiteRecordToEdit != null}
		<RecordModal bind:showModal bind:websiteRecord={websiteRecordToEdit} />
	{/if}

	{#if showVisualization}
		<VisualizationModal bind:showModal={showVisualization} rootExecutions={returnRootExecutions()}  />
	{/if}
</body>

<div class="pagination-div">
	<LightPaginationNav
		totalItems={shownRecords.length}
		{pageSize}
		{currentPage}
		limit={1}
		showStepOptions={false}
		on:setPage={(e) => (currentPage = e.detail.page)}
	/>
</div>

<div class="add-record-button-container">
	<button on:click={() => {
		showModal = true;}} 
		class="view-buttons"
		>
		Add record
	</button>

</div>

<div class="visualize-button-container">
	<button class="view-buttons"
		on:click={async () => {
			if (activeSelection.length) {
				activeSelectionStore.set(activeSelection);
				showVisualization = true;
				returnActiveExecutions();
			}
			else {
				window.alert("Please select at least one record to visualize");
			}
		}}
	>
	Visualize active selection
</button>
</div>

<style>
	.selected {
		background-color: burlywood;
	}

	.selected:hover {
		background-color: bisque;
	}
	.unselected:hover {
		background-color: bisque;
	}
	.unselected {
		background-color: beige;
	}
	ul.li-tags {
		list-style: none;
		margin: 0;
		padding-left: 10px;
	}
	.li-tags > li {
		display: inline-block;
		background-color: #b7b6b6;
		color: #333;
		border-radius: 20px;
		padding: 5px 10px;
		margin-right: 5px;
		margin-bottom: 5px;
	}
	.refresh-button {
		order: 10;
		width: 7em;
		text-align: center;
	}
	.website-record-list {
		list-style-type: none;
		padding: 10px;
		width: 90%;
		margin-left: auto;
		margin-right: auto;	

	}
	.website-record-li {
		display: flex;
		flex-direction: row;
		justify-content: space-around;
		align-items: center;
		padding: 10px;
		margin: 5px;
		border-style: solid;
		border-width: medium;
		border-color: black;
		border-radius: 10px;
		
	}
	.fields-container {
		order: 0;
		flex-grow: 2;
	}
	.record-buttons-container {
		order: 1;
		flex-grow: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 15px;

		margin-left: 10px;
	}

	.li-fields {
		border-style: solid;
		border-width: thin;
		border-color: black;
		border-radius: 5px;
		padding: 5px;
		margin: 2px 2px 2px 2px;
	}
	.pagination-div {
		position: fixed;
		z-index: 100;
		bottom: 5px;
		left: 50%;
		transform: translateX(-50%);
		background-color: beige;
	}
	.pagination-div :global(.option) {
		background-color: beige;
		border: solid black thin;
	}
	.search-bar {
		display: flex;
		flex-direction: row;
		position: fixed;
		z-index: 100;
		width: 90%;
		top: 0;
		border: solid medium black;
		border-radius: 5px;
		padding: 10px;
		margin: 0px 10px 5px 10px;
		background-color: beige;
		left: 50%;
		transform: translateX(-50%);
	}
	.add-record-button-container {
		border: thick solid;
		border-color: rgba(0, 0, 0, 0.1);
		border-radius: 5px;
		padding: 0;
		position: fixed;
		z-index: 100;
		bottom: 5px;
		right: 5px;
	}
	.visualize-button-container {
		border: thick solid;
		border-color: rgba(0, 0, 0, 0.1);
		border-radius: 5px;
		padding: 0;
		position: fixed;
		z-index: 100;
		bottom: 5px;
		left: 5px;
	}
	:global(.view-buttons) {
		border: solid medium black;
		border-radius: 5px;
		padding: 10px;
		background-color: beige;
		font-size: medium;
		font-weight: bold;
	}
	:global(.view-buttons:hover) {
		background-color: bisque;
	}

	body {
		margin-top: 5%;
		margin-bottom: 5%;
	}

	.no-results-wrapper {
		position: absolute;
		top: 50%;
		width: 100%;
	}

	.loading-spinner {
		position: relative;
		display: block;
		min-height: 20px;
	}

	:global(#cytoscape) {
		width: 100%;
		height: 100%;
	}

	.loading-spinner::before {
		content: '';
		box-sizing: border-box;
		position: absolute;
		top: 50%;
		left: 50%;
		width: 20px;
		height: 20px;
		margin-top: -10px;
		margin-left: -10px;
		border-radius: 50%;
		border: 3px solid #888484;
		border-top-color: #333;
		animation: spinner 1s linear infinite;
	}
	@keyframes spinner {
		to {
			transform: rotate(360deg);
		}
	}
</style>

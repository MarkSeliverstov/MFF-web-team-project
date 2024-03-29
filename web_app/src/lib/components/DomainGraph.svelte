<script lang="ts">
	import type { Execution } from '$lib/types';
	import cytoscape from 'cytoscape';
	import { domainGraphData } from '$lib/graphDataStore';
	import { onMount } from 'svelte';
	import NodeDetail from './NodeDetail.svelte';
	onMount(() => {
		// check if the graph data is available
		if ($domainGraphData.nodes.length && $domainGraphData.edges.length) {
			var cy = cytoscape({
				container: document.getElementById('cytoscape')
			});

			cy.add({
				nodes: $domainGraphData.nodes,
				edges: $domainGraphData.edges
			});

			cy.nodes().forEach((node) => {
				const root = node.data("root");
				if (root) {
					node.addClass('root');
				}				
			})

			cy.minZoom(0.2);
			cy.maxZoom(1.2);

			cy.style()
				.selector('node')
				.style({
					'background-color': (node) => getColorByStatusFrequency(node.data()),
					width: '35px',
					height: '35px',
					label: 'data(id)'
				})
				.selector('node.detailedView')
				.style({
					width: '90px',
					height: '90px',
					'border-color': 'black',
					'border-width': '10px',
					'font-weight': 'bold',
					'font-size': 20,
					'text-transform': 'uppercase',
					'text-background-color': 'white',
					'text-background-opacity': 1,
					'text-background-shape': 'roundrectangle',
					'text-border-opacity': 1,
					'text-border-color': 'black',
					'text-border-width': 5,
					'text-background-padding': '5px',
					'z-index': 5
				})
				.selector('node.root')
				.style({
					width: '75px',
					height: '75px',
					'border-color': 'black',
					'border-width': '5px',
					'font-weight': 'bold',
					'font-size': 20,
					'text-transform': 'uppercase',
					'text-background-color': 'beige',
					'text-background-opacity': 1,
					'text-background-shape': 'roundrectangle',
					'text-background-padding': '5px',
					'z-index': 5
				})
				.selector('edge')
				.style({
					'curve-style': 'haystack',
					'line-color': 'gray',
					'mid-target-arrow-color': 'black',
					'mid-target-arrow-shape': 'triangle',
					'arrow-scale': 1.5
				})
				.update();

			cy.on('click', 'node', (event) => showNodeDetail(event, cy));

			var layout = cy.layout({
				name: 'cose',
				animate: false,
				nodeRepulsion(node) {
					return 50000000;
				},
				idealEdgeLength(edge) {
					return 512;
				},
				edgeElasticity(edge) {
					return 256;
				}
			});

			layout.run();			
		}
	});
	let clicks = 0;
	function showNodeDetail(event: cytoscape.EventObject, cy: cytoscape.Core) {
		++clicks;
		if (clicks <= 1) {
			setTimeout(() => {
				clicks = 0;
			}, 250);
		} else if (clicks === 2) {
			clicks = 0;
			//set default style on previous selected node
			cy.nodes('.detailedView').removeClass('detailedView');
	
			//remove a previous node detail if it exists
			let previousTooltip = document.getElementById('nodeDetail');
			if (previousTooltip) {
				previousTooltip.parentElement?.removeChild(previousTooltip);
			}
	
			//animate graph centering on the clicked node
			cy.animate({
				center: {
					eles: event.target
				},
				zoom: 0.75
			});
	
			//add a style class to the clicked node
			event.target.addClass('detailedView');
	
			//create a new node detail
			const node = event.target.data();
			const target = document.getElementById('visualizationModalDialog')!;
			const tooltip = new NodeDetail({
				target: target,
				props: {
					node: node,
					onClose: () => nodeDetailOnClose(cy, event.target)
				}
			});
	
			//prevent input from affecting the graph underneath the node detail
			const detail = document.getElementById('nodeDetail')!;
	
			detail.addEventListener('mouseover', () => {
				cy.userPanningEnabled(false);
				cy.userZoomingEnabled(false);
			});
	
			detail.addEventListener('mouseout', () => {
				cy.userPanningEnabled(true);
				cy.userZoomingEnabled(true);
			});
		}
	}

	// function passed to the button on node detail; handles closing
	function nodeDetailOnClose(cy: cytoscape.Core, node: cytoscape.NodeSingular) {
		const tooltip = document.getElementById('nodeDetail');
		tooltip?.parentElement?.removeChild(tooltip);
		cy.animate({
			fit: {
				eles: cy.nodes(),
				padding: 0
			}
		});
		node.removeClass('detailedView');

		// without this, the user pan&zoom may stay disabled after closing the detail
		cy.userPanningEnabled(true);
		cy.userZoomingEnabled(true);
	}

	function getColorByStatusFrequency(nodeData: any): string {
		
		switch (Object.keys(nodeData).reduce((a, b) => (nodeData[a] > nodeData[b] ? a : b))) {

			case 'successCount':
				return 'green';
			case 'failedCount':
				return 'red';
			case 'invalidCount':
				return 'orange';
			case 'notCrawledCount':
				return 'gray'
			default:
				return 'gray';
		}
	}
</script>

<div id="cytoscape" />

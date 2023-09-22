import { CheerioAPI, load } from "cheerio";
import { URL } from "url";
import axios from 'axios';


import { CrowledWebPage } from "../types";
import { WorkerProgress } from "./types";


export class Crawler{
	// List of pages to crawl
	private pagesToCrawl: CrowledWebPage[] = [];
	// List of pages that have been crawled
	private crawledPages: CrowledWebPage[] = [];
	// The current page being crawled
	private currentCrawlingWebPage?: CrowledWebPage;	
	// Set of seen links
	private seenPages = new Set<string>;

	private isAborted = false;

	private getTotalCrawledCount() {return this.crawledPages.length + this.pagesToCrawl.length;}

	// Function to fetch a page and return its text
	private async fetchPage(url: string): Promise<string> {
		const response = await axios.get(url);
		if (response.status !== 200) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return response.data;
	}

	// Function to parse links from a Cheerio object
	private parseLinks($: CheerioAPI, baseUrl: string): string[] {
		const links: string[] = [];
		// Iterate over each 'a' tag
		$("a").each((index, element) => {
			let href = $(element).attr("href");
			// If href exists, add it to the links array
			if (href) {
				// Check if the href is a relative link
				if (!href.startsWith("http")) {
					href = new URL(href, baseUrl).href;
				}
				links.push(href);
			}
		});
		// Return the array of links
		return links;
	}

	// Function to parse links from a Cheerio object
	private parseHtml(html: string, currentPage: CrowledWebPage){
		const $ = load(html);
		// Set the start time, title, links, and end time of the current page
		currentPage.title = $("title").text();
		currentPage.links = this.parseLinks($, currentPage.url);
		currentPage.status = "done";
	}

	// Function to update the crawling progress
	private updateCrawlingProgress(
		progressCallback: (progress: WorkerProgress) => void
	): void {
		const progress : WorkerProgress = {
			crawled: this.crawledPages.length,
			total: this.getTotalCrawledCount(),
			webPages: [...this.crawledPages, ...this.pagesToCrawl]
		};
		// Call the progress callback with the progress
		progressCallback(progress);
	}

	private initCrawlingWebPage(link: string): CrowledWebPage{
		return {
			url: link,
			links: [],
			status: "pending"
		};
	}

	// Function to start the crawling process
	public async StartCrawling(
		baseUrl: URL, 
		regex: RegExp, 
		progressCallback: (progress: WorkerProgress) => void,
	) : Promise<CrowledWebPage[]>{
		// Initialize the first crawling page
		this.pagesToCrawl.push(this.initCrawlingWebPage(baseUrl.href));

		console.log(`(crawler ${process.pid}) Crawling starting`);
		while(this.pagesToCrawl.length !== 0){
			if (this.isAborted === true) {
				console.log(`(crawler ${process.pid}) Crawler was aborted, total pages crawled: ${this.crawledPages.length}`);
				return this.crawledPages;
			}

			this.currentCrawlingWebPage = this.pagesToCrawl.shift();
			if (this.currentCrawlingWebPage === undefined) continue;

			this.currentCrawlingWebPage.crawlTimeStart = Date.now();
			this.currentCrawlingWebPage.status = "inProgress";

			this.seenPages.add(this.currentCrawlingWebPage.url);

			this.updateCrawlingProgress(progressCallback);
			// If the current page's URL doesn't match the regex, continue to the next iteration
			if (!regex.test(this.currentCrawlingWebPage.url)){
				console.log(
					`(crawler ${process.pid}) Invalid URL: ${this.currentCrawlingWebPage.url}, `+
					`current progress: ${this.crawledPages.length}/${this.getTotalCrawledCount()}`
				);
				this.currentCrawlingWebPage.status = "failed";
				this.crawledPages.push(this.currentCrawlingWebPage);
				continue;
			}

			try{
				// Fetch the page and add its URL to the seen links
				const html = await this.fetchPage(this.currentCrawlingWebPage.url);
				console.log(
					`(crawler ${process.pid}) Crawling ${this.currentCrawlingWebPage.url}, `+
					`current progress: ${this.crawledPages.length}/${this.getTotalCrawledCount()}`
				);

				// If the page was loaded successfully, crawl it
				if (html) {
					this.parseHtml(html, this.currentCrawlingWebPage);
					// Add the current page to the crawled pages
					this.crawledPages.push(this.currentCrawlingWebPage);
					// Add the links to the pages to crawl from the crawled page
					for (const link of this.currentCrawlingWebPage.links) {
						if (!this.seenPages.has(link) && !this.pagesToCrawl.some(page => page.url === link)) {
							this.pagesToCrawl.push(this.initCrawlingWebPage(link));
						}
					}
				} else {
					this.currentCrawlingWebPage.status = "done";
					this.crawledPages.push(this.currentCrawlingWebPage);
				}
			}
			catch (error) {
				// If an error occurred while fetching the page, log it and add the page to the crawled pages
				this.currentCrawlingWebPage.status = "failed";
				this.crawledPages.push(this.currentCrawlingWebPage);
				console.log(
					`(crawler ${process.pid}) Crawling failed ${this.currentCrawlingWebPage.url}, `+
					`current progress: ${this.crawledPages.length}/${this.getTotalCrawledCount()}, ${error}`
				);
			} finally {
				this.currentCrawlingWebPage.crawlTimeEnd = Date.now();
				// Calculate the time spent crawling the current page
				const crawlTime = this.currentCrawlingWebPage.crawlTimeEnd - this.currentCrawlingWebPage.crawlTimeStart;
				console.log(`(crawler ${process.pid}) Time spent crawling ${this.currentCrawlingWebPage.url}: ${crawlTime} ms`);
			}
		}

		console.log(`(crawler ${process.pid}) Crawling finished, total pages crawled: ${this.crawledPages.length}`);
		return this.crawledPages;
	}

	public abort(): void {
		this.isAborted = true;
	}
}
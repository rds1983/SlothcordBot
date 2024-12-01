import { JSDOM } from "jsdom";
import { BaseProcessorImpl } from "./BaseProcessor";
import { Utility } from "./Utility";
import { Constants } from "./Constants";

global.HTMLAnchorElement = require("xhr2");

class Post {
	threadName: string;
	threadLink: string;
	poster: string;
	posterLink: string;
}

export class ForumProcessor extends BaseProcessorImpl<Post[]>
{
	getName(): string {
		return "forum";
	}

	runIntervalInMs(): number {
		return 5 * 60 * 1000;
	}

	async reportNewPost(newPost: Post): Promise<void> {
		this.sendMessage(`[${newPost.poster}](${newPost.posterLink}) made a new post in the thread '[${newPost.threadName}](${newPost.threadLink})'`);
	}

	async internalProcess(): Promise<void> {
		this.logInfo("Checking forum...");

		let data = await this.loadPage(Constants.ForumUrl);
		const dom = new JSDOM(data);
		let document = dom.window.document;

		let all = document.getElementsByTagName("tr");
		let foundHeader = false;

		let newPosts = [];
		for (let i = 0; i < all.length; i++) {
			let children = all[i].childNodes;

			if (children.length < 1) {
				continue;
			}

			// Check if it's group header row
			let td = children[0];

			if (!foundHeader) {
				if (td.textContent.includes("Last Forum Posts")) {
					foundHeader = true;
					this.logInfo("found header");
				}
			} else {
				if (children.length == 4) {
					let threadName = children[0].textContent.trim();
					let anchor = <HTMLAnchorElement>Utility.FindChild(children[0], n => "href" in n);
					let threadLink = anchor != null ? anchor.href : "";
					let poster = children[1].textContent.trim();

					anchor = <HTMLAnchorElement>Utility.FindChild(children[1], n => "href" in n);
					let posterLink = anchor != null ? anchor.href : "";

					let newPost: Post =
					{
						threadName: threadName,
						threadLink: threadLink,
						poster: poster,
						posterLink: posterLink
					};

					newPosts.push(newPost);

					this.logInfo(`${threadName}/${threadLink}/${poster}/${posterLink}`);
				}
			}
		}

		try {
			if (this.status != null) {
				let oldTopPost = this.status[0];
				let oldTopPostIndex: number = null;
				for (let i = 0; i < newPosts.length; ++i) {
					let newPost = newPosts[i];

					if (newPost.threadName == oldTopPost.threadName) {
						oldTopPostIndex = i;
						break;
					}
				}

				this.logInfo(`oldTopPostIndex: ${oldTopPostIndex}`);

				if (oldTopPostIndex != null) {
					// All posts before oldTopPostIndex are new
					for (let i = 0; i < oldTopPostIndex; ++i) {
						let newPost = newPosts[i];
						await this.reportNewPost(newPost);
					}

					// If poster has changed then the post is new too
					if (newPosts[oldTopPostIndex].poster != oldTopPost.poster) {
						await this.reportNewPost(newPosts[oldTopPostIndex]);
					}
				} else {
					this.logInfo(`WARNING: could not find oldTopPostIndex`);
				}
			}
		}
		catch (err) {
			this.logInfo(err);
		}

		this.status = newPosts;
		this.saveStatus();
	}

	process(onFinished: () => void): void {
		this.internalProcess().catch(err => this.logError(err)).finally(onFinished);
	}
}
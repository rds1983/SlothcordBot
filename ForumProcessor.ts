import { JSDOM } from "jsdom";
import { BaseProcessorImpl } from "./BaseProcessor";
import { Utility } from "./Utility";

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

		var data = await this.loadPage("http://www.slothmud.org/wp/");
		const dom = new JSDOM(data);
		var document = dom.window.document;

		var all = document.getElementsByTagName("tr");
		var foundHeader = false;

		var newPosts = [];
		for (var i = 0; i < all.length; i++) {
			var children = all[i].childNodes;

			if (children.length < 1) {
				continue;
			}

			// Check if it's group header row
			var td = children[0];

			if (!foundHeader) {
				if (td.textContent.includes("Last Forum Posts")) {
					foundHeader = true;
					this.logInfo("found header");
				}
			} else {
				if (children.length == 4) {
					var threadName = children[0].textContent.trim();
					var anchor = <HTMLAnchorElement>Utility.FindChild(children[0], n => "href" in n);
					var threadLink = anchor != null ? anchor.href : "";
					var poster = children[1].textContent.trim();

					anchor = <HTMLAnchorElement>Utility.FindChild(children[1], n => "href" in n);
					var posterLink = anchor != null ? anchor.href : "";

					var newPost: Post =
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

		if (this.status != null) {
			var oldTopPost = this.status[0];
			var oldTopPostIndex = 0;
			for (var i = 0; i < newPosts.length; ++i) {
				var newPost = newPosts[i];

				if (newPost.threadName == oldTopPost.threadName) {
					oldTopPostIndex = i;
					break;
				}
			}

			this.logInfo(`oldTopPostIndex: ${oldTopPostIndex}`);

			// All posts before oldTopPostIndex are new
			for (var i = 0; i < oldTopPostIndex; ++i) {
				var newPost = newPosts[i];
				await this.reportNewPost(newPost);
			}

			// If poster has changed then the post is new too
			if (newPosts[oldTopPostIndex].poster != oldTopPost.poster) {
				await this.reportNewPost(newPosts[oldTopPostIndex]);
			}
		}

		this.status = newPosts;
		this.saveStatus();
	}

	process(): void {
		this.internalProcess().catch(err => this.logError(err));
	}
}
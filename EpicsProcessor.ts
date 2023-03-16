import { Client } from "discord.js";
import { JSDOM } from "jsdom";
import { BaseProcessorImpl } from "./BaseProcessor";

class Epic {
	name: string;
	area: string;
	continent: string;
}

export class EpicsProcessor extends BaseProcessorImpl<Epic[]>
{
	constructor(client: Client) {
		super(client);
	}

	getName(): string {
		return "epics";
	}

	runIntervalInMs(): number {
		return 5 * 60 * 1000;
	}

	async internalProcess(): Promise<void> {
		this.logInfo("Checking epics...");

		let data = await this.loadPage("http://www.slothmud.org/support/mapserver2.php?filter=all");
		let dom = new JSDOM(data);
		let document = dom.window.document;

		let newEpics = [];
		let all = document.getElementsByTagName("div");
		for (let i = 0; i < all.length; i++) {
			let div = all[i];

			let area = div.getAttribute("area");
			let continent = div.getAttribute("continent");

			if (area == null || continent == null) {
				continue;
			}

			// Filter out non real epics
			if (continent.toLowerCase() == "godsland") {
				continue;
			}

			if (continent.toLowerCase() == "valkyre" && !area.toLowerCase().startsWith("dark")) {
				continue;
			}

			let name = div.textContent;

			this.logInfo(`${name}; ${area}; ${continent}`);

			let epic: Epic =
			{
				name: name,
				area: area,
				continent: continent
			}

			newEpics.push(epic);
		}

		let changed = false;

		if (this.status != null) {
			// Report new epics
			for (let i = 0; i < newEpics.length; ++i) {
				let newEpic = newEpics[i];
				let found = false;
				for (let j = 0; j < this.status.length; ++j) {
					let oldEpic = this.status[j];

					if (newEpic.name == oldEpic.name) {
						found = true;
						break;
					}
				}

				if (!found) {
					changed = true;
				}
			}

			// Report killed epics
			for (let i = 0; i < this.status.length; ++i) {
				let oldEpic = this.status[i];
				let found = false;
				for (let j = 0; j < newEpics.length; ++j) {
					let newEpic = newEpics[j];

					if (newEpic.name == oldEpic.name) {
						found = true;
						break;
					}
				}

				if (!found) {
					changed = true;
				}
			}
		} else {
			changed = true;
		}

		if (changed) {
			let result = "";
			for (let i = 0; i < newEpics.length; ++i) {
				let epic = newEpics[i];
				result += `${i + 1}. ${epic.name} in ${epic.area} at ${epic.continent}\n`;
			}

			// Fetch old messages
			let messages = await this.channel.messages.fetch();
			let messagesArray = Array.from(messages.values());

			// Post new messages with the epics' status
			await this.sendMessage(result);

			// Delete old messages
			try {
				for (let i = 0; i < messagesArray.length; ++i) {
					await messagesArray[i].delete();
				}
			}
			catch (err: any) {
				this.logError(err);
			}
		}

		this.status = newEpics;
		this.saveStatus();
	}

	process(): void {
		this.internalProcess().catch(err => this.logError(err));
	}
}
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

		var data = await this.loadPage("http://www.slothmud.org/support/mapserver2.php?filter=all");
		var dom = new JSDOM(data);
		var document = dom.window.document;

		var newEpics = [];
		var all = document.getElementsByTagName("div");
		for (var i = 0; i < all.length; i++) {
			var div = all[i];

			var area = div.getAttribute("area");
			var continent = div.getAttribute("continent");

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

			var name = div.textContent;

			this.logInfo(`${name}; ${area}; ${continent}`);

			var epic: Epic =
			{
				name: name,
				area: area,
				continent: continent
			}

			newEpics.push(epic);
		}

		var changed = false;

		if (this.status != null) {
			// Report new epics
			for (var i = 0; i < newEpics.length; ++i) {
				var newEpic = newEpics[i];
				var found = false;
				for (var j = 0; j < this.status.length; ++j) {
					var oldEpic = this.status[j];

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
			for (var i = 0; i < this.status.length; ++i) {
				var oldEpic = this.status[i];
				var found = false;
				for (var j = 0; j < newEpics.length; ++j) {
					var newEpic = newEpics[j];

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
			var result = "";
			for (var i = 0; i < newEpics.length; ++i) {
				var epic = newEpics[i];
				result += `${i + 1}. ${epic.name} in ${epic.area} at ${epic.continent}\n`;
			}

			// Fetch old messages
			var messages = await this.channel.messages.fetch();
			var messagesArray = Array.from(messages.values());

			// Post new messages with the epics' status
			await this.sendMessage(result);

			// Delete old messages
			try {
				for (var i = 0; i < messagesArray.length; ++i) {
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
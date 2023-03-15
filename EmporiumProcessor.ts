import { JSDOM } from "jsdom";
import { BaseProcessorImpl } from "./BaseProcessor";
import { Utility } from "./Utility";

class Auction {
	name: string;
	bidder: string;
	price: string;
	buyout: string;
	ends: string;
	lastWarning: boolean;
}

export class EmporiumProcessor extends BaseProcessorImpl<{ [seller: string]: Auction[] }>
{
	getName(): string {
		return "emporium";
	}

	runIntervalInMs(): number {
		return 5 * 60 * 1000;
	}

	static buildItemLink(name: string): string {
		return `[${name}](http://slothmudeq.ml/?search=${encodeURI(name)})`;
	}

	async reportNewItem(seller: string, name: string, price: string, buyout: string, ends: string): Promise<void> {
		var link = EmporiumProcessor.buildItemLink(name);
		this.sendMessage(`${seller} has put '${link}' on sale. Price/buyout is ${price}/${buyout}. The sale ends in ${ends}.`);
	}

	async reportSoldItem(seller: string, name: string, bidder: string, price: string): Promise<void> {
		var link = EmporiumProcessor.buildItemLink(name);

		if (bidder.toLowerCase() == "nobody") {
			this.sendMessage(`${seller}'s item '${link}' is no longer available for sale.`);
		} else {
			this.sendMessage(`${seller}'s item '${link}' had been sold to ${bidder} for ${price}.`);
		}
	}

	convertEndsToMinutes(ends: string): number {
		var minutesLeft = 0;

		try {
			var parts = ends.split(' ');
			for (var j = 0; j < parts.length; ++j) {
				var part = parts[j].trim();
				var re = /(\d+)(\w)/;
				var m = re.exec(part);
				if (m) {
					var value = parseInt(m[1]);
					if (m[2] == "d") {
						minutesLeft += 24 * 60 * value;
					} else if (m[2] == "h") {
						minutesLeft += 60 * value;
					} else if (m[2] == "m") {
						minutesLeft += value;
					}
				}
			}

			return minutesLeft;
		}
		catch (err: any) {
			this.logError(err);
		}

		return 0;
	}

	async internalProcess(): Promise<void> {
		this.logInfo("Checking auctions...");

		var data = await this.loadPage("http://www.slothmud.org/wp/live-info/live-auctions");

		const dom = new JSDOM(data);
		var document = dom.window.document;

		var all = document.getElementsByTagName("tr");

		var count = 0;
		var newAuctions: { [seller: string]: Auction[] } = {};
		for (var i = 0; i < all.length; i++) {
			var children = all[i].childNodes;

			if (children.length < 6) {
				continue;
			}

			var id = children[0].textContent.trim();

			if (!Utility.isNumeric(id)) {
				continue;
			}

			var name = children[1].textContent.trim();
			var seller = children[2].textContent.trim();
			var bidder = children[3].textContent.trim();
			var price = children[4].textContent.trim();
			var buyout = children[5].textContent.trim();
			var ends = children[6].textContent.trim();
			this.logInfo(`${id}, ${name}, ${seller}, ${price}, ${buyout}, ${ends}`);

			var item: Auction =
			{
				name: name,
				bidder: bidder,
				price: price,
				buyout: buyout,
				ends: ends,
				lastWarning: false
			};

			var sellerData: Auction[];
			if (!(seller in newAuctions)) {
				sellerData = [];
				newAuctions[seller] = sellerData;
			} else {
				sellerData = newAuctions[seller];
			}

			sellerData.push(item);
			++count;
		}

		this.logInfo(`Items count: ${count}`);

		if (this.status != null) {
			for (var seller in newAuctions) {
				this.logInfo(`Going through items of ${seller}`);
				if (!(seller in this.status)) {
					// New seller
					this.logInfo(`New seller`);
					// Report every item
					var sellerData = newAuctions[seller];
					for (var i = 0; i < sellerData.length; ++i) {
						var item = sellerData[i];
						await this.reportNewItem(seller, item.name, item.price, item.buyout, item.ends);
					}
				} else {
					// Remove existing items
					var newData = newAuctions[seller].slice();
					var oldData = this.status[seller];

					var newDataSameIndices: { [index: number]: boolean } = {};
					var oldDataSameIndices: { [index: number]: boolean } = {};

					for (var i = 0; i < newData.length; ++i) {
						var newItem = newData[i];
						for (var j = 0; j < oldData.length; ++j) {
							if (j in oldDataSameIndices) {
								continue;
							}

							var oldItem = oldData[j];
							if (newItem.name == oldItem.name) {
								// Mark item as same in both lists
								newDataSameIndices[i] = true;
								oldDataSameIndices[j] = true;

								if ("lastWarning" in oldItem) {
									newItem.lastWarning = oldItem.lastWarning;
								}
								break;
							}
						}
					}

					// Report remaining new items as put on sale
					for (var i = 0; i < newData.length; ++i) {
						// Last warning
						var item = newData[i];

						var minutesLeft = this.convertEndsToMinutes(item.ends);
						if (minutesLeft > 0 && minutesLeft <= 120 && !item.lastWarning) {
							var link = EmporiumProcessor.buildItemLink(item.name);
							await this.sendMessage(`The auction for ${seller}'s item '${link}' will end in less than two hours.`);
							item.lastWarning = true;
						}

						if (i in newDataSameIndices) {
							continue;
						}

						await this.reportNewItem(seller, item.name, item.price, item.buyout, item.ends);
					}

					// Report remaining old items as sold
					for (var i = 0; i < oldData.length; ++i) {
						if (i in oldDataSameIndices) {
							continue;
						}

						var item = oldData[i];
						await this.reportSoldItem(seller, item.name, item.bidder, item.price);
					}
				}
			}

			// Report items of disappeared sellers as sold
			for (var seller in this.status) {
				if (!(seller in newAuctions)) {
					var items = this.status[seller];
					for (var i = 0; i < items.length; ++i) {
						var item = items[i];
						await this.reportSoldItem(seller, item.name, item.bidder, item.price);
					}
				}
			}
		} else {
			this.logInfo("Existing auctions data is empty.");
		}

		this.status = newAuctions;
		this.saveStatus();
	}

	process(): void {
		this.internalProcess().catch(err => this.logError(err));
	}
}
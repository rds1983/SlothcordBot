import { JSDOM } from "jsdom";
import { BaseProcessorImpl } from "./BaseProcessor";
import { Utility } from "./Utility";
import { Statistics } from "./Statistics";

class Auction {
	name: string;
	bidder: string;
	price: string;
	buyout: string;
	ends: string;
	lastWarning: boolean;
}

export class EmporiumProcessor extends BaseProcessorImpl<{ [seller: string]: Auction[] }> {
	getName(): string {
		return "emporium";
	}

	runIntervalInMs(): number {
		return 5 * 60 * 1000;
	}

	public static buildItemLink(name: string): string {
		return `[${name}](http://eq.slothmud.org/?search=${encodeURI(name)})`;
	}

	private static priceToNumber(price: string): number {
		price = price.replace(/,/g, "");
		return parseInt(price);
	}

	async reportNewItem(seller: string, name: string, price: string, buyout: string, ends: string): Promise<void> {
		let link = EmporiumProcessor.buildItemLink(name);
		await this.sendMessage(`${seller} has put '${link}' on sale. Price/buyout is ${price}/${buyout}. The sale ends in ${ends}.`);
	}

	async reportSoldItem(seller: string, name: string, bidder: string, price: string, buyout: string, ends: string): Promise<void> {
		let link = EmporiumProcessor.buildItemLink(name);

		let minutesLeft = this.convertEndsToMinutes(ends);
		if (bidder.toLowerCase() == "nobody") {
			if (minutesLeft < 40) {
				await this.sendMessage(`${seller}'s item '${link}' is no longer available for sale.`);
			} else {
				await this.sendMessage(`${seller}'s item '${link}' had been bought out for ${buyout}.`);
				await Statistics.storeSale(seller, name, EmporiumProcessor.priceToNumber(buyout));
			}
		} else {
			await this.sendMessage(`${seller}'s item '${link}' had been sold to ${bidder} for ${price}.`);
			await Statistics.storeSale(seller, name, EmporiumProcessor.priceToNumber(price));
		}
	}

	convertEndsToMinutes(ends: string): number {
		let minutesLeft = 0;

		try {
			let parts = ends.split(' ');
			for (let j = 0; j < parts.length; ++j) {
				let part = parts[j].trim();
				let re = /(\d+)(\w)/;
				let m = re.exec(part);
				if (m) {
					let value = parseInt(m[1]);
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

		let data = await this.loadPage("http://www.slothmud.org/wp/live-info/live-auctions");

		const dom = new JSDOM(data);
		let document = dom.window.document;

		let all = document.getElementsByTagName("tr");

		let count = 0;
		let newAuctions: { [seller: string]: Auction[] } = {};
		for (let i = 0; i < all.length; i++) {
			let children = all[i].childNodes;

			if (children.length < 6) {
				continue;
			}

			let id = children[0].textContent.trim();

			if (!Utility.isNumeric(id)) {
				continue;
			}

			let name = children[1].textContent.trim();
			let seller = children[2].textContent.trim();
			let bidder = children[3].textContent.trim();
			let price = children[4].textContent.trim();
			let buyout = children[5].textContent.trim();
			let ends = children[6].textContent.trim();
			this.logInfo(`${id}, ${name}, ${seller}, ${price}, ${buyout}, ${ends}`);

			let item: Auction =
			{
				name: name,
				bidder: bidder,
				price: price,
				buyout: buyout,
				ends: ends,
				lastWarning: false
			};

			let sellerData: Auction[];
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

		if (count == 0) {
			// Workaround of buggy site behavior when it returns empty auction list sometimes
			this.logInfo(`Ignoring emporium processing...`);
			return;
		}

		try {
			if (this.status != null) {
				for (let seller in newAuctions) {
					this.logInfo(`Going through items of ${seller}`);
					if (!(seller in this.status)) {
						// New seller
						this.logInfo(`New seller`);
						// Report every item
						let sellerData = newAuctions[seller];
						for (let i = 0; i < sellerData.length; ++i) {
							let item = sellerData[i];
							await this.reportNewItem(seller, item.name, item.price, item.buyout, item.ends);
						}
					} else {
						// Remove existing items
						let newData = newAuctions[seller].slice();
						let oldData = this.status[seller];

						let newDataSameIndices: { [index: number]: boolean } = {};
						let oldDataSameIndices: { [index: number]: boolean } = {};

						for (let i = 0; i < newData.length; ++i) {
							let newItem = newData[i];
							for (let j = 0; j < oldData.length; ++j) {
								if (j in oldDataSameIndices) {
									continue;
								}

								let oldItem = oldData[j];
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
						for (let i = 0; i < newData.length; ++i) {
							// Last warning
							let item = newData[i];

							let minutesLeft = this.convertEndsToMinutes(item.ends);
							if (minutesLeft > 0 && minutesLeft <= 120 && !item.lastWarning) {
								let link = EmporiumProcessor.buildItemLink(item.name);

								let message = `The auction for ${seller}'s item '${link}' will end in less than two hours.`;
								if (item.bidder != "Nobody") {
									message += ` The highest bid ${item.price} was placed by ${item.bidder}.`
								}

								await this.sendMessage(message);
								item.lastWarning = true;
							}

							if (i in newDataSameIndices) {
								continue;
							}

							await this.reportNewItem(seller, item.name, item.price, item.buyout, item.ends);
						}

						// Report remaining old items as sold
						for (let i = 0; i < oldData.length; ++i) {
							if (i in oldDataSameIndices) {
								continue;
							}

							let item = oldData[i];
							await this.reportSoldItem(seller, item.name, item.bidder, item.price, item.buyout, item.ends);
						}
					}
				}

				// Report items of disappeared sellers as sold
				for (let seller in this.status) {
					if (!(seller in newAuctions)) {
						let items = this.status[seller];
						for (let i = 0; i < items.length; ++i) {
							let item = items[i];
							await this.reportSoldItem(seller, item.name, item.bidder, item.price, item.buyout, item.ends);
						}
					}
				}
			} else {
				this.logInfo("Existing auctions data is empty.");
			}
		}
		catch (err) {
			this.logError(err);
		}

		this.status = newAuctions;
		this.saveStatus();
	}

	process(onFinished: () => void): void {
		this.internalProcess().catch(err => this.logError(err)).finally(onFinished);
	}
}
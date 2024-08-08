
import { EmbedBuilder, Message, TextChannel } from "discord.js";
import moment from "moment";
import { Logger } from "winston";

const winston = require('winston');
const { combine, timestamp, printf } = winston.format;

export class Utility {
	static createLogger(name: string): Logger {
		return winston.createLogger({
			format: combine(
				timestamp({
					format: 'YYYY-MM-DD HH:mm:ss',
				}),
				printf((info: any) => `[${info.timestamp}] ${info.level}: ${info.message}`)
			),
			transports: [
				new winston.transports.Console(),
				new winston.transports.File({ filename: `log.${name}.txt`, json: false }),
			],
		});
	}

	static formatTwoDigits(num: number): string {
		let result = `${num}`;

		if (num < 10) {
			result = '0' + result;
		}

		return result;
	}

	static formatNumber(num: number): string {
		return num.toLocaleString("en-US");
	}

	static toString(obj: any) {
		if (typeof obj == "string") {
			return obj;
		} else if (obj instanceof Error) {
			return obj.message;
		}

		return JSON.stringify(obj);
	}

	static isNumeric(val: string): boolean {
		return !isNaN(parseInt(val));
	}

	static FindChild(node: ChildNode, check: (n: ChildNode) => boolean): ChildNode {
		if (node == null || node.childNodes == null || node.childNodes.length == 0) {
			return null;
		}

		for (let i = 0; i < node.childNodes.length; ++i) {
			let n = node.childNodes[i];
			if (check(n)) {
				return n;
			}
		}

		return null;
	}

	static toUnixTimeStamp(d: Date): number {
		return Math.floor(d.getTime() / 1000);
	}

	static getUnixTimeStamp(): number {
		return this.toUnixTimeStamp(new Date());
	}

	static formatOnlyDate(value: number) {
		return moment.unix(value).format("MMMM Do YYYY");
	}

	static formatDateTime(value: number) {
		return moment.unix(value).format("MMMM Do YYYY, HH:mm");
	}

	static async sendEmbed(channel: TextChannel, message: EmbedBuilder): Promise<Message<true>> {
		return channel.send({ embeds: [message] });
	}

	static async sendMessage(channel: TextChannel, message: string): Promise<Message<true>> {
		const embed = new EmbedBuilder().setDescription(message);
		return this.sendEmbed(channel, embed);
	}
}


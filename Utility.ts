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

	static formatTwoDigits(num: number) {
		let result = `${num}`;

		if (num < 10) {
			result = '0' + result;
		}

		return result;
	}

	static toString(obj: any) {
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

	static getUnixTimeStamp(): number {
		return Math.floor(new Date().getTime() / 1000);
	}
}


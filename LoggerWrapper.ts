import { Logger } from "winston";
import { Utility } from "./Utility";

export class LoggerWrapper {
	private logger: Logger;

	constructor(name: string) {
		this.logger = Utility.createLogger(name);
	}

	logError(message: any): void {
		this.logger.log({
			level: 'error',
			message: Utility.toString(message)
		});
	}

	logInfo(message: any): void {
		this.logger.log({
			level: 'info',
			message: Utility.toString(message)
		});
	}
}
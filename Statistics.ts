import { Logger } from "winston";
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { Utility } from "./Utility";

const fs = require('fs');

enum EventType {
	Death,
	Raise
}

class Event {
	type: EventType;
	adventurer: string;
	timeStamp: number;
}

export class Statistics {
	private static readonly logger: Logger = Utility.createLogger("statistics");

	private static readonly DbFileName: string = "data.db";

	private static logError(message: any): void {
		this.logger.log({
			level: 'error',
			message: Utility.toString(message)
		});
	}

	private static logInfo(message: any): void {
		this.logger.log({
			level: 'info',
			message: Utility.toString(message)
		});
	}

	private static async openDb(): Promise<Database> {
		let dbExists = fs.existsSync(this.DbFileName);

		let result = await open({
			filename: this.DbFileName,
			driver: sqlite3.Database
		});

		// If the db file didnt exist, then create the tables
		if (!dbExists) {
			await result.exec('CREATE TABLE events(id INTEGER PRIMARY KEY, type INTEGER, adventurer TEXT, timeStamp INTEGER);');
			await result.exec('CREATE TABLE doers(id INTEGER PRIMARY KEY, eventId INTEGER, name TEXT, FOREIGN KEY(eventId) REFERENCES events(id));');
		}


		return result;
	}

	private static async logEventWithDoerAsync(type: EventType, adventurer: string, doer: string): Promise<void> {
		let connection = await this.openDb();

		let timeStamp = Utility.getUnixTimeStamp();
		let cmd = `INSERT INTO events(type, adventurer, timeStamp) VALUES(${type}, '${adventurer}', ${timeStamp})`;
		let result = await connection.run(cmd);

		let eventId = result.lastID;
		cmd = `INSERT INTO doers(eventId, name) VALUES(${eventId}, '${doer}')`;
		result = await connection.run(cmd);

		await connection.close();

		this.logInfo(`Added ${type} event #${eventId}: ${adventurer}, ${doer}, ${timeStamp}`);
	}

	static logDeath(adventurer: string, killer: string): void {
		this.logEventWithDoerAsync(EventType.Death, adventurer, killer).catch(err => this.logError(err));
	}

	static logRaise(adventurer: string, raised: string): void {
		this.logEventWithDoerAsync(EventType.Raise, adventurer, raised).catch(err => this.logError(err));
	}
}

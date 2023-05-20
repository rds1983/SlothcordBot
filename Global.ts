export class Config
{
	token: string;
	excludeFromAlert: string[];
}

export class Global
{
	static config: Config;
	static usersToCharacters: { [user: string]: string[] };
}
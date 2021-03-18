import {events} from "bdsx/event";
import {ServerPlayer} from "bdsx/bds/player";
import {existsSync, readFileSync, writeFileSync} from "fs";
import {bedrockServer, CANCEL, command, nethook, PacketId} from "bdsx";
import {TextPacket} from "bdsx/bds/packets";

const system = server.registerSystem(0, 0);

const moneys = new Map<string, User>();

const addresses = new Map<string, string>();

const xuids = new Map<string, string>();

if(!existsSync(__dirname + "/settings.json")){
	writeFileSync(__dirname + "/settings.json", JSON.stringify({
		default_money: 1000,
		prefix: "§b§l[EconomyAPI]§r§7"
	}));
}

const settings = JSON.parse(readFileSync("settings.json").toString());

if(!existsSync(__dirname + "/money.json")){
	writeFileSync(__dirname + "/money.json", "{}");
}

const moneyData = JSON.parse(readFileSync(__dirname + "/money.json").toString());

const id = setInterval(async () => {
	writeData();
	await writeFile();
}, 1000 * 60);

bedrockServer.close.on(async () => {
	writeData();
	await writeFile();
	clearInterval(id);
});

events.playerJoin.on((event) => {
	const player = event.player;

	if(!moneys.has(player.getName().toLowerCase())){
		moneys.set(player.getName().toLowerCase(), new User(player.getName().toLowerCase(), moneyData[player.getName().toLowerCase()] ?? settings.default_money));
	}
});

function writeData(): void{
	for(const user of moneys.values()){
		moneyData[user.getPlayer().toLowerCase()] = user.getMoney();
	}
}

async function writeFile(): Promise<void>{
	await writeFileSync("money.json", JSON.stringify(moneyData));
}

nethook.after(PacketId.Disconnect).on((packet, networkIdentifier, packetId) => {
	const ip = networkIdentifier.getAddress();
	const name = addresses.get(ip.toLowerCase());
	if(!name){
		return;
	}
	const user = moneys.get(name.toLowerCase());
	if(!user){
		return;
	}
	moneyData[name.toLowerCase()] = user.getMoney();
	moneys.delete(name.toLowerCase());
	addresses.delete(ip.toLowerCase());
	if(xuids.has(name.toLowerCase())){
		xuids.delete(name.toLowerCase());
	}
});

nethook.after(PacketId.Login).on((packet, networkIdentifier, packetId) => {
	const ip = networkIdentifier.getAddress();
	console.log(ip);
	const [xuid, name] = nethook.readLoginPacket(packet);

	addresses.set(ip.toLowerCase(), name.toLowerCase());
	xuids.set(name.toLowerCase(), xuid);
});

command.hook.on((command, origin) => {
	const commands = [
		"mymoney",
		"seemoney",
		"pay",
	];
	for(const cmd of commands){
		if(command.includes(cmd)){
			return 0;
		}
	}

	const args = command.split(/\s+/);
	const realCommand = args.shift();

	if(realCommand === "/setmoney"){
		if(origin.toLowerCase() !== "server"){
			system.executeCommand(`tell "${origin}" You don't have permission to execute this command.`, (unused) => {
			});
			return 0;
		}
		const player = args.shift();
		const amount = args.shift();
		if(!player || !amount){
			console.log("Usage: /setmoney <player> <money>");
			return 0;
		}
		const money = parseInt(amount);
		if(isNaN(money) || money < 0 || money >= MAXIMUM_MONEY){
			console.log("Invalid money given.");
			return 0;
		}
		setMoney(player, money);
		console.log(`Player ${player}'s money was set to \$${money}.`);
		return 0;
	}
	if(realCommand === "/takemoney"){
		if(origin.toLowerCase() !== "server"){
			system.executeCommand(`tell "${origin}" You don't have permission to execute this command.`, (unused) => {
			});
			return 0;
		}
		const player = args.shift();
		const amount = args.shift();
		if(!player || !amount){
			console.log("Usage: /takemoney <player> <money>");
			return 0;
		}
		const money = parseInt(amount);
		if(isNaN(money) || money < 0 || money >= MAXIMUM_MONEY){
			console.log("Invalid money given.");
			return 0;
		}
		if(getMoney(player) - money < 0){
			console.log("Cannot take money that results in negative balance.");
			return 0;
		}
		reduceMoney(player, money);
		console.log(`Taken \$${money} from ${player}.`);
		return 0;
	}
	if(realCommand === "/givemoney"){
		if(origin.toLowerCase() !== "server"){
			system.executeCommand(`tell "${origin}" You don't have permission to execute this command.`, (unused) => {
			});
			return 0;
		}
		const player = args.shift();
		const amount = args.shift();
		if(!player || !amount){
			console.log("Usage: /givemoney <player> <money>");
			return 0;
		}
		const money = parseInt(amount);
		if(isNaN(money) || money < 0 || money >= MAXIMUM_MONEY){
			console.log("Invalid money given.");
			return 0;
		}
		if(getMoney(player) + money > MAXIMUM_MONEY){
			console.log("Cannot give money that results in maximum balance.");
			return 0;
		}
		addMoney(player, money);
		console.log(`Given \$${money} to ${player}.`);
		return 0;
	}
});

nethook.after(PacketId.CommandRequest).on((packet, networkIdentifier, packetId) => {
	const wholeCommand = packet.command;
	const actor = networkIdentifier.getActor();
	if(actor == null) return;

	const args = wholeCommand.split(/\s+/);
	const command = args.shift();
	if(command === "/mymoney"){
		sendMessage(actor, `Your money: \$${getMoney(actor.getName())}`);
		return CANCEL;
	}
	if(command === "/seemoney"){
		const player = args.shift();
		if(!player){
			sendMessage(actor, "Usage: /seemoney <player>");
			return CANCEL;
		}
		if(!hasAccount(player)){
			sendMessage(actor, `There is no such user '${player}'`);
			return CANCEL;
		}
		sendMessage(actor, `Player ${player}'s money: \$${getMoney(player)}`);
		return CANCEL;
	}
	if(command === "/pay"){
		const player = args.shift();
		const amount = args.shift();
		if(!player || !amount){
			sendMessage(actor, "Usage: /pay <player> <money>");
			return CANCEL;
		}
		const money = parseInt(amount);
		if(isNaN(money) || money < 0 || money >= MAXIMUM_MONEY){
			sendMessage(actor, "Invalid money given.");
			return CANCEL;
		}
		const playerMoney = getMoney(actor.getName());
		if(playerMoney - money < 0){
			sendMessage(actor, "You don't have enough money to pay.");
			return CANCEL;
		}
		reduceMoney(actor.getName(), money);
		addMoney(player, money);
		sendMessage(actor, `Paid ${player} to \$${money}.`);
		system.executeCommand(`tell "${player}" ${actor.getName()} gave you \$${money}.`, (unused) => {
		});
		return CANCEL;
	}
});

function sendMessage(actor: ServerPlayer, message: string, type: number = 1): void{
	const prefix = settings.prefix;
	message = prefix.substr(-1) === " " ? prefix + message : prefix + " " + message;
	const packet = TextPacket.create();
	packet.message = message;
	packet.type = type;
	packet.sendTo(actor.getNetworkIdentifier());
	packet.dispose();
}

export function hasAccount(player: string): boolean{
	const user = moneys.get(player.toLowerCase());
	if(!user){
		if(!moneyData[player.toLowerCase()]){
			return false;
		}
	}
	return true;
}

export function getMoney(player: string): number{
	const user = moneys.get(player.toLowerCase());
	if(!user){
		if(!moneyData[player.toLowerCase()]){
			return RET_NO_ACCOUNT;
		}
		return moneyData[player.toLowerCase()];
	}
	return user.getMoney();
}

export function addMoney(player: string, money: number): number{
	const user = moneys.get(player.toLowerCase());
	if(!user){
		if(!moneyData[player.toLowerCase()]){
			return RET_NO_ACCOUNT;
		}
		if(money >= MAXIMUM_MONEY){
			return RET_INVALID;
		}
		if(money <= 0){
			return RET_INVALID;
		}
		if(money + moneyData[player.toLowerCase()] >= MAXIMUM_MONEY){
			return RET_INVALID;
		}
		moneyData[player.toLowerCase()] += money;
		return RET_SUCCESS;
	}
	return user.addMoney(money);
}

export function reduceMoney(player: string, money: number): number{
	const user = moneys.get(player.toLowerCase());
	if(!user){
		if(!moneyData[player.toLowerCase()]){
			return RET_NO_ACCOUNT;
		}
		if(money >= MAXIMUM_MONEY){
			return RET_INVALID;
		}
		if(money <= 0){
			return RET_INVALID;
		}
		if(moneyData[player.toLowerCase()] - money < 0){
			return RET_NOT_ENOUGH_MONEY;
		}
		moneyData[player.toLowerCase()] -= money;
		return RET_SUCCESS;
	}

	return user.reduceMoney(money);
}

export function setMoney(player: string, money: number): number{
	const user = moneys.get(player.toLowerCase());
	if(!user){
		if(!moneyData[player.toLowerCase()]){
			return RET_NO_ACCOUNT;
		}
		if(money >= MAXIMUM_MONEY){
			return RET_INVALID;
		}
		if(money < 0){
			return RET_INVALID;
		}
		moneyData[player.toLowerCase()] = money;
		return RET_SUCCESS;
	}
	return user.setMoney(money);
}

export function getUser(player: string): User | null{
	const user = moneys.get(player.toLowerCase());
	if(!user){
		return null;
	}
	return user;
}

export class User{

	player: string;

	money: number;

	constructor(player: string, money: number){
		this.player = player;
		this.money = money;
	}

	getMoney(): number{
		return this.money;
	}

	getPlayer(): string{
		return this.player;
	}

	addMoney(money: number): number{
		if(money >= MAXIMUM_MONEY){
			return RET_INVALID;
		}
		if(money <= 0){
			return RET_INVALID;
		}
		if(money + this.money >= MAXIMUM_MONEY){
			return RET_INVALID;
		}
		this.money += money;
		return RET_SUCCESS;
	}

	reduceMoney(money: number): number{
		if(money >= MAXIMUM_MONEY){
			return RET_INVALID;
		}
		if(money <= 0){
			return RET_INVALID;
		}
		if(this.getMoney() - money < 0){
			return RET_NOT_ENOUGH_MONEY;
		}
		this.money -= money;
		return RET_SUCCESS;
	}

	setMoney(money: number): number{
		if(money >= MAXIMUM_MONEY){
			return RET_INVALID;
		}
		if(money < 0){
			return RET_INVALID;
		}
		this.money = money;
		return RET_SUCCESS;
	}
}

export const MAXIMUM_MONEY = 1000000000;

export const RET_SUCCESS = -1;

export const RET_INVALID = -2;

export const RET_NOT_ENOUGH_MONEY = -3;

export const RET_NO_ACCOUNT = -4;
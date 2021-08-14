//can I help work on some things in this and use this part?
import { MinecraftPacketIds } from 'bdsx/bds/packetids';
import {events} from "bdsx/event";
import {TextPacket} from "bdsx/bds/packets";
import { Player } from 'bdsx/bds/player';
import { parseJSON, writeJSON } from './utils';

let id: NodeJS.Timeout;

export let moneyData = parseJSON("../scriptData/money.json");

export const moneys = new Map<Player, User>();

const addresses = new Map<string, string>();

const xuids = new Map<string, string>();

function sendMessage(actor: Player, message: string, type: number = 1): void{
	const packet = TextPacket.create();
	packet.message = message;
	packet.type = type;
	packet.sendTo(actor.getNetworkIdentifier());
	packet.dispose();
}

function hasAccount(player: Player): boolean{
	const user = moneys.get(player);
	if(!user){
		if(!moneyData[player.getName().toLowerCase()]){
			return false;
		}
	}
	return true;
}

export function getMoney(player: Player): number{
	const user = moneys.get(player);
	if(!user){
		if(!moneyData[player.getName().toLowerCase()]){
			
			return RET_NO_ACCOUNT;
		}
		
		return moneyData[player.getName().toLowerCase()];
	}
	
	return user.getMoney();
}

export function addMoney(player: Player, money: number): number{
	const user = moneys.get(player);
	if(!user){
		if(!moneyData[player.getName().toLowerCase()]){
			
			return RET_NO_ACCOUNT;
		}
		if(money >= MAXIMUM_MONEY){
			
			return RET_INVALID;
		}
		if(money <= 0){
			
			return RET_INVALID;
		}
		if(money + moneyData[player.getName().toLowerCase()] >= MAXIMUM_MONEY){
			
			return RET_INVALID;
		}
		
		moneyData[player.getName().toLowerCase()] += money;
		return RET_SUCCESS;
	}
	
	return user.addMoney(money);
}

export function reduceMoney(player: Player, money: number): number{
	const user = moneys.get(player);
	if(!user){
		if(!moneyData[player.getName().toLowerCase()]){
			
			return RET_NO_ACCOUNT;
		}
		if(money >= MAXIMUM_MONEY){
			
			return RET_INVALID;
		}
		if(money <= 0){
			
			return RET_INVALID;
		}
		if(moneyData[player.getName().toLowerCase()] - money < 0){
			
			return RET_NOT_ENOUGH_MONEY;
		}
		moneyData[player.getName().toLowerCase()] -= money;
		
		return RET_SUCCESS;
	}

	return user.reduceMoney(money);
	
}

export function setMoney(player: Player, money: number): number{
	
	const user = moneys.get(player);
	if(!user){
		if(!moneyData[player.getName().toLowerCase()]){
			
			return RET_NO_ACCOUNT;
		}
		if(money >= MAXIMUM_MONEY){
			
			return RET_INVALID;
		}
		if(money < 0){
			
			return RET_INVALID;
		}
		moneyData[player.getName()] = money;
		
		return RET_SUCCESS;
	}
	return user.setMoney(money);
}

export function getUser(player: Player): User | null{
	
	const user = moneys.get(player);
	if(!user){
		return null;
	}
	return user;
}

export class User{

	player: Player;

	money: number;

	constructor(player: Player, money: number){
		this.player = player;
		this.money = money;
	}

	getMoney(): number{
		return this.money;
	}

	getPlayer(): Player{
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

export const MAXIMUM_MONEY = 2147483647;

export const RET_SUCCESS = -1;

export const RET_INVALID = -2;

export const RET_NOT_ENOUGH_MONEY = -3;

export const RET_NO_ACCOUNT = -4;

// json stuff

events.serverOpen.on(() => {
	id = setInterval(() => {
		    writeJSON("../scriptData/money.json", moneyData);
	    }, 1000 * 60);  
});
    
events.serverClose.on(() => {
	writeJSON("../scriptData/money.json", moneyData);
	clearInterval(id);
});

events.packetAfter(MinecraftPacketIds.Login).on((packet, networkIdentifier) => {
	const ip = networkIdentifier.getAddress();
	console.log(ip);
	let xuid, name;

	var actor = networkIdentifier.getActor();

	name = networkIdentifier.getActor()?.getName();

	if (packet.connreq == null) return;
	
	xuid = packet.connreq.cert.toString();

	if (name != null && actor != null) {
	addresses.set(ip.toLowerCase(), name.toLowerCase());
	xuids.set(name.toLowerCase(), xuid);
	moneyData[name] = getMoney(actor);
	}
	writeJSON("../scriptData/money.json", moneyData);
});

events.packetAfter(MinecraftPacketIds.Disconnect).on((p, networkIdentifier) => {
	const name = addresses.get(networkIdentifier.getAddress().toLowerCase());
	if(!name){
		return;
	}
	if (networkIdentifier.getActor() == null) {
		const user = moneys.get(networkIdentifier.getActor() as Player);
	if(!user){
		return;
	}
	moneyData[name.toLowerCase()] = user.getMoney();
	moneys.delete(networkIdentifier.getActor() as Player);
	addresses.delete(name);
	
	if(xuids.has(name.toLowerCase())){
		xuids.delete(name.toLowerCase());
	}}
	writeJSON("../scriptData/money.json", moneyData);
});

const colors = require('colors/safe');
const sleep = require('sleep-promise');
const { Random } = require('koishi-utils');

const utils = require('./utils');

class Role {
	log() {
		console.log(colors.brightBlue('[ROLE]'), colors.blue(this.name), ...arguments);
	}

	addPlayer(player) {
		this.log('add', player.displayName);
		this.playerList.push(player);
	}

	removePlayer(player) {
		let index = -1;
		for (const i in this.playerList) {
			const currentPlayer = this.playerList[i];
			if (currentPlayer.id == player.id) {
				index = i;
				break;
			}
		}

		if (index !== -1) {
			this.playerList.splice(index, 1);
		} else {
			console.error('ERROR! No such player to remove.');
		}
	}

	resetPlayer() {
		while (this.playerList.length) {
			this.playerList.pop();
		}
	}

	send(message) {
		for (const currentPlayer of this.playerList) {
			currentPlayer.send(message);
		}
	}

	isActive() {
		return this.playerList.length !== 0;
	}

	isAlive() {
		for (const currentPlayer of this.playerList) {
			if (currentPlayer.alive) {
				return true;
			}
		}
		return false;
	}

	processNight(roundId) {
		this.roundId = roundId;
		this.roundType = 'night';
		console.warn('WARN! Function `processNight` undefined.');
	}

	async help(player) {
		if (!this.helpMessage || !this.helpMessage.length) {
			player.send('当前角色暂时没有帮助信息');
			return;
		}

		await player.send(this.helpMessage.join('\n'));
	}

	getName() {
		return this.name || this.displayName.replace(/\[CQ.+?\]/g, '');
	}

	getDisplayName() {
		return this.displayName || this.name;
	}

	isWolf() {
		return this.name === 'werewolf';
	}

	async setTimeLimit(timeLimit, resolver) {
		if (!timeLimit || isNaN(parseInt(timeLimit))) {
			return;
		}
		timeLimit = parseInt(timeLimit) * 1000;

		const myKey = Random.int(1, 1145141919810);
		this.timeLimitKey = myKey;

		const warnTimeInterval = [15 * 1000, 5 * 1000, 0];
		for (const warnTime of warnTimeInterval) {
			if (timeLimit > warnTime) {
				await sleep(timeLimit - warnTime);

				if (this.timeLimitKey === myKey) {
					timeLimit = warnTime;
					if (warnTime) {
						this.send(`你还有 ${warnTime / 1000} 秒的决策时间，超时将按照 pass 进行结算`);
					} else {
						await sleep(150);
						this.send('决策超时，自动结算');
						resolver();
						this.endTurn();
					}
				} else {
					return;
				}
			}
		}
	}

	endTurn() {
		this.roundId = null;
		this.roundType = null;

		this.promise = null;

		this.dayResolver = undefined;
		this.skillResolver = undefined;
		this.nightResolver = undefined;
		this.killedResolver = undefined;

		this.timeLimitKey = null;
	}

	async onGameStart() { }
	async onGameStop() { }

	constructor(game) {
		this.game = game;
		this.logger = this.game.logger;
		this.sendGroup = (message) => this.game.sendGroup(message);
		this.sendPlayer = (message) => this.game.sendPlayer(message);

		this.roundId = null;
		this.roundType = null;

		this.playerList = [];
		this.helpMessage = [];

		this.commands = ['help'];
	}
}

module.exports = Role;
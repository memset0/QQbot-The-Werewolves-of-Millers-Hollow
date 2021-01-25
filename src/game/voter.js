const assert = require('assert');

class Voter {

	log() {
		console.log('[VOTE]', ...arguments);
	}

	countResult() {
		return Object.keys(this.result).length
	}

	countVotablePlayer() {
		return this.votablePlayers.length;
	}

	isEnd() {
		if (this.countVotablePlayer() === this.countResult()) {
			return true;
		} else {
			return false;
		}
	}

	vote(player, targetPlayer) {
		if (!this.promise) {
			player.send('投票未开始');
			return;
		}
		if (!this.votablePlayers.includes(player.id)) {
			player.send('你没有投票权限');
			return;
		}
		if (!targetPlayer || !this.targets.includes(targetPlayer.id)) {
			player.send('投票不合法');
			return;
		}

		if (Object.keys(this.result).includes(String(player.id))) {
			player.send('你已经投票 / 弃权过了');
			return;
		}

		this.result[String(player.id)] = targetPlayer;
		
		this.log('Vote', player.displayName, 'To', targetPlayer.displayName);
		player.send(`你投票给了 ${targetPlayer.displayName}`);
		this.game.sendGroup(`${player.displayName} 完成投票，当前投票情况 ${this.countResult()} / ${this.countVotablePlayer()}`);

		if (this.isEnd()) {
			this.end();
		}
	}

	pass(player) {
		if (!this.promise) {
			player.send('投票未开始');
			return;
		}
		if (!this.votablePlayers.includes(player.id)) {
			player.send('你没有投票权限');
			return;
		}

		if (Object.keys(this.result).includes(String(player.id))) {
			player.send('你已经投票 / 弃权过了');
			return;
		}

		this.result[String(player.id)] = null;
		
		this.log('Pass', player.displayName);
		player.send('你放弃了你的投票权');
		this.game.sendGroup(`${player.displayName} 完成投票，当前投票情况 ${this.countResult()} / ${this.countVotablePlayer()}`);
		
		if (this.isEnd()) {
			this.end();
		}
	}

	process() {
		if (this.promise) {
			console.error('ERROR! A vote is already started!');
			return;
		}

		return new Promise((resolve, reject) => {
			this.promise = { resolve, reject };
			this.result = {};
			if (this.isEnd()) {
				this.end();
			}
		});
	}

	async end() {
		const sheriffId = this.game.sheriff.exists() ? String(this.game.sheriff.get().id) : null;
		let voteCounter = {};
		let countResult = [];
		for (const playerId in this.result) {
			const targetPlayer = this.result[playerId], weight = playerId === sheriffId ? 1.5 : 1;
			if (targetPlayer) {
				if (voteCounter[targetPlayer.id]) {
					voteCounter[targetPlayer.id] += weight;
					countResult[targetPlayer.id].push(this.game.getPlayer(playerId));
				} else {
					voteCounter[targetPlayer.id] = weight;
					countResult[targetPlayer.id] = [this.game.getPlayer(playerId)];
				}
			}
		}
		this.log('End', voteCounter);

		let response = [];
		let maxVoteNumber = -1;
		for (const targetPlayerId in voteCounter) {
			let voteNumber = voteCounter[targetPlayerId];
			this.log('>', targetPlayerId, voteNumber);
			if (voteNumber > maxVoteNumber) {
				maxVoteNumber = voteNumber;
				response = [this.game.getPlayer(targetPlayerId)];
			} else if (voteNumber == maxVoteNumber) {
				response.push(this.game.getPlayer(targetPlayerId));
			}
		}
		this.log('Result', response.map(player => player.displayName), maxVoteNumber);

		await this.game.helper.listVotes(this.result, countResult);

		this.promise.resolve(response);
		this.promise = null;
	}

	async stop() {
		if (this.promise) {
			this.promise.resolve();
			this.promise = null;
		}
	}

	reset() {
		this.promise = null;
	}

	constructor(game) {
		this.game = game;
		assert(this.game);
		this.votablePlayers = [];
		this.targets = [];
		this.reset();
	}
}

module.exports = Voter;

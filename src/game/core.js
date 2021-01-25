const colors = require('colors/safe');

const utils = require('./utils');
const config = require('../../config');

const Logger = require('./logger');
const Player = require('./player');
const Voter = require('./voter');
const Speech = require('./speech');
const Sheriff = require('./sheriff');
const Seer = require('./roles/seer');
const Hunter = require('./roles/hunter');
const Witch = require('./roles/witch');
const Villager = require('./roles/villager');
const Werewolf = require('./roles/werewolf');

class Game {

	log() {
		console.log('[GAME]', ...arguments);
	}

	async sendGroup(message) {
		console.log(colors.cyan('[SEND G]'), message.slice(0, 40).replace(/\n/g, colors.grey('\\n')), message.length > 40 ? colors.grey('...') : '');
		return await this.bot.sendGroupMsg(config.group, message);
	}

	async sendPlayer(message) {
		if (typeof message === 'function') {
			return await Promise.all(this.playerList.map(player => {
				this.bot.sendPrivateMessage(player.id, message(player));
			}));
		} else {
			return await Promise.all(this.playerList.map(player => {
				this.bot.sendPrivateMessage(player.id, message);
			}));
		}
	}

	addPlayer(player) {
		this.playerList.push(player);
	}

	removePlayer(player) {
		let index = -1;
		for (const i in this.playerList) {
			const registeredPlayer = this.playerList[i];
			if (registeredPlayer.id == player.id) {
				index = i;
				break;
			}
		}
		if (index > -1) {
			this.playerList.splice(index, 1);
			return true;
		}
		return false;
	}

	getPlayer(input) {
		for (const player of this.playerList) {
			if (player.id === parseInt(input)) {
				return player;
			}
		}
		for (const player of this.playerList) {
			if (player.place === parseInt(input)) {
				return player;
			}
		}
		for (const player of this.playerList) {
			if (player.nick === String(input)) {
				return player;
			}
		}
		for (const player of this.playerList) {
			if (player.displayName === String(input)) {
				return player;
			}
		}
		return null;
	}

	getAlivePlayerList() {
		let alivePlayerList = [];
		for (const player of this.playerList) {
			if (player.alive) {
				alivePlayerList.push(player);
			}
		}
		return alivePlayerList;
	}

	findNextAlivePlayer(currentPlayer) {
		let targetPlace = currentPlayer.place;
		while (targetPlace === currentPlayer.place || !this.getPlayer(targetPlace).alive) {
			targetPlace++;
			if (targetPlace === this.playerList.length + 1) {
				targetPlace = 1;
			}
			if (targetPlace === currentPlayer.place) {
				return null;
			}
		}
		return this.getPlayer(targetPlace);
	}

	findPrevAlivePlayer(currentPlayer) {
		let targetPlace = currentPlayer.place;
		while (targetPlace === currentPlayer.place || !this.getPlayer(targetPlace).alive) {
			targetPlace--;
			if (targetPlace === 0) {
				targetPlace = this.playerList.length;
			}
			if (targetPlace === currentPlayer.place) {
				return null;
			}
		}
		return this.getPlayer(targetPlace);
	}

	async setRole(player, role) {
		player.setRole(role);
		this.roles[role].addPlayer(player);
		await player.send(`游戏开始！你的角色是 ${this.roles[role].getDisplayName()}`);
	}


	getTemplate() {
		const playerNumber = this.playerList.length;
		for (const template of this.templateList) {
			if (template.length === playerNumber) {
				return template;
			}
		}
		return null;
	}

	setTemplate(template) {
		this.templateList = [template];
	}


	checkWinCondition() {
		if (config.rule.winCondition === 'all') {
			let flag
			let counter
			flag = false;
			for (const player of this.playerList) {
				if (player.role !== 'werewolf' && player.alive) {
					flag = true;
				}
			}
			if (!flag) {
				return {
					res: true,
					winner: '狼人',
					message: '所有好人已经出局',
				};
			}
			flag = false;
			for (const player of this.playerList) {
				if (player.role === 'werewolf' && player.alive) {
					flag = true;
				}
			}
			if (!flag) {
				return {
					res: true,
					winner: '好人',
					message: '所有狼人已经出局'
				};
			}
			counter = 0;
			for (const player of this.playerList) {
				if (player.alive) {
					if (player.role === 'werewolf') {
						counter++;
					} else {
						counter--;
					}
				}
			}
			if (counter >= 0) {
				return {
					res: true,
					winner: '狼人',
					message: '未出局的好人数量小于等于狼人数量'
				};
			}

		} else if (config.rule.winCondition === 'part') {
			let flag_1
			let flag_2
			flag_1 = false;
			flag_2 = false;
			for (const player of this.playerList) {
				if (player.role === 'villager') {
					flag_1 = true;
					if (player.alive) {
						flag_2 = true;
					}
				}
			}
			if (flag_1 && !flag_2) {
				return {
					res: true,
					winner: '狼人',
					message: '所有村民已经出局'
				};
			}
			flag_1 = false;
			flag_2 = false;
			for (const player of this.playerList) {
				if (player.role !== 'werewolf' && player.role !== 'villager') {
					flag_1 = true;
					if (player.alive) {
						flag_2 = true;
					}
				}
			}
			if (flag_1 && !flag_2) {
				return {
					res: true,
					winner: '狼人',
					message: '所有神已经出局'
				};
			}
			flag_2 = false;
			for (const player of this.playerList) {
				if (player.role === 'werewolf' && player.alive) {
					flag_2 = true;
				}
			}
			if (!flag_2) {
				return {
					res: true,
					winner: '好人',
					message: '所有狼人已经出局'
				};
			}
		}

		return {
			res: false,
			winner: null,
			error: '没有合法的获胜条件',
		}
	}

	async processKilled(player) {
		if (player.role === 'hunter') {
			if (!this.roles.witch.poisonedPlayer || player.id !== this.roles.witch.poisonedPlayer.id) {
				await this.roles.hunter.processKilled();
				if (this.roles.hunter.shotPlayer) {
					this.roles.hunter.shotPlayer.alive = false;
					await this.processKilled(this.roles.hunter.shotPlayer);
				}
			}
		}
	}

	async processNight(roundId) {
		this.roundId = roundId;
		this.roundType = 'night';
		await this.sendGroup(`第 ${roundId} 个晚上开始了`);

		await this.roles.werewolf.processNight(roundId);
		await this.roles.witch.processNight(roundId);
		await this.roles.seer.processNight(roundId);

		const diedPlayerList = [];
		if (this.roles.werewolf.killedPlayer && (!this.roles.witch.savedPlayer || this.roles.witch.savedPlayer.id !== this.roles.werewolf.killedPlayer.id)) {
			diedPlayerList.push(this.roles.werewolf.killedPlayer);
		}
		if (this.roles.witch.poisonedPlayer) {
			diedPlayerList.push(this.roles.witch.poisonedPlayer);
		}
		let hasBoomed = false;
		if (config.query('rule.sheriff', false) && (roundId === 1 || (roundId === 2 && this.sheriff.crashed))) {
			hasBoomed = !await this.sheriff.runForTheSheriff();
		}

		for (const currentPlayer of diedPlayerList) {
			currentPlayer.alive = false;
		}
		utils.random.shuffle(diedPlayerList);

		let message = `第 ${roundId} 个晚上结束了，`;
		if (diedPlayerList.length === 0) {
			message += `今天是平安夜`;
		} else if (diedPlayerList.length === 1) {
			message += `今天晚上 [CQ:at,qq=${diedPlayerList[0].id}] 死了`;
		} else if (diedPlayerList.length === 2) {
			message += `今天晚上 [CQ:at,qq=${diedPlayerList[0].id}] 和 [CQ:at,qq=${diedPlayerList[1].id}] 死了`;
		}
		if (roundId === 1 && diedPlayerList.length !== 0 && !hasBoomed) {
			message += '，请留遗言';
		}
		await this.sendGroup(message);

		for (const diedPlayer of diedPlayerList) {
			await this.processKilled(diedPlayer);
		}

		if (this.checkWinCondition().res) {
			await this.stop();
		} else if (hasBoomed) {
			await this.processNight(roundId + 1);
		} else {
			await this.processDay(roundId, diedPlayerList);
		}
	}

	async processDay(roundId, diedPlayerList = []) {
		this.roundId = roundId;
		this.roundType = 'day';

		await this.sendGroup(`第 ${roundId} 个白天开始了，请进行发言`);

		let speechOrder;
		const alivePlayerList = this.getAlivePlayerList();
		const generateSpeechOrder = (firstPlayer, side, playerList = alivePlayerList) => {
			let speechOrder = [];
			let index = playerList.indexOf(firstPlayer);
			do {
				speechOrder.push(playerList[index]);
				if (side === 'right') {
					index++;
					if (index === playerList.length) {
						index = 0;
					}
				} else {
					if (index === 0) {
						index = playerList.length;
					}
					index--;
				}
			} while (index != playerList.indexOf(firstPlayer));
			return speechOrder;
		};
		if (this.sheriff.exists()) {
			if (diedPlayerList.length === 1) {
				await this.sendGroup('请警长选择死左死右发言');
				let diedPlayer = diedPlayerList[0];
				let side = await this.sheriff.get().waitForReceiveGroup(['left', 'right']);
				if (side === 'left') {
					speechOrder = generateSpeechOrder(this.findPrevAlivePlayer(diedPlayer), 'left');
				} else {
					speechOrder = generateSpeechOrder(this.findNextAlivePlayer(diedPlayer), 'right');
				}
			} else {
				await this.sendGroup('请警长选择警左警右发言');
				let side = await this.sheriff.get().waitForReceiveGroup(['left', 'right']);
				speechOrder = generateSpeechOrder(this.sheriff.get(), side);
			}
		} else {
			await this.sendGroup('本局游戏没有警长，采取随机顺序发言');
			if (diedPlayerList.length === 1) {
				let diedPlayer = diedPlayerList[0];
				if (utils.random.choose(['right', 'left']) === 'right') {
					speechOrder = generateSpeechOrder(this.findNextAlivePlayer(diedPlayer), 'right');
				} else {
					speechOrder = generateSpeechOrder(this.findPrevAlivePlayer(diedPlayer), 'left');
				}
			} else {
				speechOrder = generateSpeechOrder(utils.random.choose(alivePlayerList), utils.random.choose(['right', 'left']));
			}
		}

		if (await this.speech.process(speechOrder)) {
			await this.sendGroup('发言完毕，请投票');

			this.voter.votablePlayers = this.voter.targets = alivePlayerList.map(player => player.id);
			let voteResult = await this.voter.process();

			if (voteResult.length !== 1) {
				await this.sendGroup('第一轮投票没有结果，请进行第二轮发言');
				if (await this.speech.process(generateSpeechOrder(utils.random.choose(voteResult), utils.random.choose(['right', 'left']), voteResult))) {
					await this.sendGroup('发言完毕，请投票');
					voteResult = await this.voter.process();
				} else {
					voteResult = null;
				}
			}

			if (voteResult) {
				if (voteResult.length === 1) {
					await this.sendGroup(`投票结束，${voteResult[0].displayName} 出局了`);
					voteResult[0].alive = false;
					await this.processKilled(voteResult[0]);
				} else {
					await this.sendGroup('投票结束，没有人出局');
				}
			}
		}

		if (this.checkWinCondition().res) {
			await this.stop();
		} else {
			await this.processNight(roundId + 1);
		}
	}

	async start() {
		if (this.started) {
			await this.sendGroup('游戏已经开始');
			return;
		}
		if (!this.getTemplate()) {
			await this.sendGroup('没有合法的板子，无法开始游戏');
			return;
		}

		this.started = true;
		this.logger.reset();

		for (const roleName in this.roles) {
			const roleClass = this.roles[roleName];
			roleClass.resetPlayer();
		}

		let roleList = this.getTemplate();
		utils.random.shuffle(roleList);

		for (const i in roleList) {
			const player = this.playerList[i];
			const role = roleList[i];

			player.setPlace(parseInt(i) + 1);
			await this.setRole(player, role);
		}

		for (const roleName in this.roles) {
			const roleClass = this.roles[roleName];
			await roleClass.onGameStart();
			for (const player of roleClass.playerList) {
				roleClass.help(player);
			}
		}

		await this.processNight(1);
	}

	async stop(result = null) {
		if (!this.started) {
			await this.sendGroup('游戏尚未开始');
			return;
		}

		if (!result) {
			result = this.checkWinCondition();
			if (!result.res) {
				result = {
					...result,
					message: '游戏被手动结束',
					winner: 'bot ',
				};
			}
		}

		let message = '游戏结束！\n' +
			`因为${result.message}，${result.winner}阵营获得胜利\n` +
			'存活玩家：\n';
		for (const player of this.playerList) {
			if (player.alive) {
				message += `<${this.roles[player.role].getDisplayName()}> ${player.displayName} [CQ:at,qq=${player.id}]\n`;
			}
		}
		message += '死亡玩家：\n';
		for (const player of this.playerList) {
			if (!player.alive) {
				message += `<${this.roles[player.role].getDisplayName()}> ${player.displayName} [CQ:at,qq=${player.id}]\n`;
			}
		}
		message += '感谢你的游玩';
		await this.sendGroup(message);

		this.started = false;
		this.playerList = [];

		this.voter.promise = null;
		this.speech.promise = null;
		for (const roleName in this.roles) {
			let roleClass = this.roles[roleName];
			roleClass.promise = null;
		}
	}

	async register(id) {
		console.log('[GAME]', 'Register', id);

		if (this.started) {
			await this.sendGroup(`[CQ:at,qq=${id}] 游戏已经开始了，无法注册`);
			return;
		}

		if (this.getPlayer(id)) {
			await this.sendGroup(`[CQ:at,qq=${id}] 注册失败，你已经成功报名`);
			return;
		}

		this.addPlayer(new Player(id, this));
		const currentPlayer = this.getPlayer(id);
		await this.sendGroup(`[CQ:at,qq=${currentPlayer.id}] 玩家 ${currentPlayer.getNick()} 注册成功！`);
		await this.helper.listAllPlayers();
		await currentPlayer.send('hello！我是狼人杀 bot (*^▽^*)\n游玩前建议阅读说明书：https://github.com/memset0/QQbot-The-Werewolves-of-Millers-Hollow，别忘了给个 star 哦');
	}

	async unregister(id) {
		this.log('Unregister', id);

		if (this.started) {
			await this.sendGroup(`[CQ:at,qq=${id}] 游戏已经开始了，无法取消注册`);
			return;
		}

		if (!this.getPlayer(id)) {
			await this.sendGroup(`[CQ:at,qq=${id}] 取消注册失败，你尚未成功报名`);
			return;
		}

		this.removePlayer(this.getPlayer(id));
		await this.sendGroup(`[CQ:at,qq=${id}] 成功取消注册`);
		await this.helper.listAllPlayers();
	}

	async status() {
		this.log('Status');

		await this.helper.listAllPlayers();
	}

	constructor(app, bot) {
		this.app = app;
		this.bot = bot;
		this.started = false;
		this.playerList = [];

		this.config = config;
		this.templateList = config.templates;

		this.logger = new Logger();
		this.roles = {
			werewolf: new Werewolf(this),
			witch: new Witch(this),
			seer: new Seer(this),
			hunter: new Hunter(this),
			villager: new Villager(this),
		};
		this.voter = new Voter(this);
		this.speech = new Speech(this);
		this.sheriff = new Sheriff(this);

		this.helper = {
			listAllPlayers: async () => {
				let message = '';
				if (this.playerList.length) {
					message += `已经注册的玩家有 ${this.playerList.length} 个：\n`;
					for (const i in this.playerList) {
						const player = this.playerList[i];
						if (this.started) {
							message += `${player.displayName} (${player.alive ? '存活' : '出局'})\n`;
						} else {
							message += `[${parseInt(i) + 1}]${player.nick}\n`;
						}
					}
				} else {
					message += '当前没有玩家注册';
				}
				return await this.sendGroup(message);
			},

			listVotes: async (voteResult, countResult) => {
				let message = '';
				message += '本轮票型：';
				for (const player of this.playerList) {
					const targetPlayer = voteResult[player.id];
					if (targetPlayer !== undefined) {
						message += `\n${player.displayName} → ${targetPlayer ? targetPlayer.displayName : null}`;
					}
				}
				message += '\n本轮票数统计：';
				for (const playerId in countResult) {
					const player = this.getPlayer(playerId);
					message += `\n${player.displayName} 获得 ${countResult[playerId].length} 票，来自：`
					for (const index in countResult[playerId]) {
						message += countResult[playerId][index].displayName;
						if (index + 1 !== countResult[playerId].length) {
							message += '，';
						}
					}
				}
				return await this.sendGroup(message);
			},
		}
	}
}

module.exports = Game;
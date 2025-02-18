"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backup = exports.writeComment = exports.setUnDone = exports.setDone = exports.setUnStartChapter = exports.setStartChapter = exports.setUnShowResults = exports.setShowResults = exports.setUnFinished = exports.setFinished = exports.writeAnswer = exports.writeGroup = exports.writeUser = exports.addToGroup = exports.getGroupUserData = exports.storeVersion = exports.getGroup = exports.removeUser = exports.getUser = void 0;
const redisconnection_1 = require("./redisconnection");
const sequelize_1 = require("sequelize");
const connection_1 = __importDefault(require("./connection"));
const sequelize = new sequelize_1.Sequelize(connection_1.default.database, process.env.MYSQL_USER, process.env.MYSQL_PASSWORD, {
    host: connection_1.default.host,
    // port: connection.port,
    dialect: "mariadb",
});
const GROUPS = sequelize.define("groups", {
    groupid: { type: sequelize_1.DataTypes.STRING, allowNull: false, primaryKey: true },
    version: { type: sequelize_1.DataTypes.STRING },
    position: { type: sequelize_1.DataTypes.STRING },
    started: { type: sequelize_1.DataTypes.JSON },
    users: { type: sequelize_1.DataTypes.JSON },
    finished: { type: sequelize_1.DataTypes.JSON },
    showResults: { type: sequelize_1.DataTypes.JSON },
});
const USERS = sequelize.define("users", {
    userid: { type: sequelize_1.DataTypes.STRING, allowNull: false, primaryKey: true },
    groupid: { type: sequelize_1.DataTypes.JSON },
    name: { type: sequelize_1.DataTypes.STRING },
    answers: { type: sequelize_1.DataTypes.JSON },
    done: { type: sequelize_1.DataTypes.JSON },
});
const COMMENTS = sequelize.define("comments", {
    id: { type: sequelize_1.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    text: { type: sequelize_1.DataTypes.TEXT },
    groupid: { type: sequelize_1.DataTypes.STRING },
    userid: { type: sequelize_1.DataTypes.JSON },
    score: { type: sequelize_1.DataTypes.STRING },
    duration: { type: sequelize_1.DataTypes.STRING },
});
USERS.sync().catch((err) => {
    console.warn('---\nCannot create table "users".\n---');
    console.warn(err);
});
GROUPS.sync().catch((err) => {
    console.warn('---\nCannot create table "groups".\n---');
    console.warn(err);
});
COMMENTS.sync().catch((err) => {
    console.warn('---\nCannot create table "comments".\n---');
    console.warn(err);
});
sequelize.getQueryInterface().addColumn('groups', 'version', {
    type: sequelize_1.DataTypes.TEXT,
}).then(x => {
    console.log('column added');
}).catch(x => {
    console.log('column exists probably');
});
function getUser({ userid, groupid, name, }) {
    return __awaiter(this, void 0, void 0, function* () {
        /*
        get or create
        */
        let user = false;
        // get redis user
        const redisUser = yield redisconnection_1.redisPubClient.get(`user-${userid}`);
        // if not, get sqlgroup
        if (!redisUser) {
            // get sqlgroup
            // user = await sql.getUser(id)
            // set redisgroup
            if (user) {
                // fill with group data
                yield writeUser(user, "redis");
            }
        }
        else {
            user = JSON.parse(redisUser);
        }
        // return group if found
        if (typeof user === "object") {
            return user;
        }
        // create user if no redis && no mysql:
        const emptyUser = {
            userid,
            groupid,
            name,
            answers: {},
            done: [],
        };
        yield writeUser(emptyUser);
        return emptyUser;
    });
}
exports.getUser = getUser;
function removeUser({ groupid, userid, }) {
    return __awaiter(this, void 0, void 0, function* () {
        // remove from group
        const group = yield getGroup(groupid);
        if (!group) {
            throw Error("Group does not exist.");
        }
        group.users = group.users.filter((x) => {
            return x !== userid;
        });
        if (group) {
            yield writeGroup(group);
        }
    });
}
exports.removeUser = removeUser;
function getGroup(groupid) {
    return __awaiter(this, void 0, void 0, function* () {
        /*
        get or create
        */
        let group = false;
        // get redis group
        const redisGroup = yield redisconnection_1.redisPubClient.get(`group-${groupid}`);
        // if not, get sqlgroup
        if (!redisGroup) {
            // get sqlgroup
            // group = await sql.get(id)
            // set redisgroup
            if (group) {
                // fill with group data
                yield writeGroup(group, "redis");
            }
        }
        else {
            group = JSON.parse(redisGroup);
        }
        // return group if found
        if (typeof group === "object") {
            return group;
        }
        // create group if no redis && no mysql:
        const emptyGroup = {
            version: '',
            groupid,
            position: 0,
            started: [],
            users: [],
            finished: [],
            showResults: [],
        };
        yield writeGroup(emptyGroup);
        return emptyGroup;
    });
}
exports.getGroup = getGroup;
function storeVersion({ groupid, version }) {
    return __awaiter(this, void 0, void 0, function* () {
        // only to sql
        const ret = yield GROUPS.upsert({ groupid, version }).catch((err) => {
            console.log("--- storeVersion sql error ---");
        });
    });
}
exports.storeVersion = storeVersion;
function getGroupUserData(groupid) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = [];
        const group = yield getGroup(groupid);
        if (!group) {
            throw Error("Group does not exist.");
        }
        for (let i in group.users) {
            const userid = group.users[i];
            const userdata = yield getUser({ groupid, userid });
            if (typeof userdata === "object") {
                data.push(userdata);
            }
        }
        return data;
    });
}
exports.getGroupUserData = getGroupUserData;
function addToGroup({ groupid, userid, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const group = yield getGroup(groupid);
        if (!group) {
            throw Error(`Group does not exist. (groupid: ${groupid}, addToGroup)`);
        }
        if (!group.users.includes(userid)) {
            group.users.push(userid);
        }
        // l1('add to group')
        // l3(group)
        yield writeGroup(group);
        return true;
    });
}
exports.addToGroup = addToGroup;
function writeUser(user, service) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!user.userid) {
            console.log("--- writeUser: missing userid ---", new Date().toString());
            return false;
        }
        // redis
        if (!service || service === "redis") {
            yield redisconnection_1.redisPubClient.set(`user-${user.userid}`, JSON.stringify(user));
        }
        // sql
        if (!service || service === "sql") {
            yield USERS.upsert(user).catch((err) => {
                console.log("--- writeUser sql error ---");
                console.log(err);
            });
        }
    });
}
exports.writeUser = writeUser;
function writeGroup(group, service) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!group.groupid) {
            console.log("--- missing group id ---", new Date().toString());
            return false;
        }
        // redis
        if (!service || service === "redis") {
            // l4('write group redis', group)
            yield redisconnection_1.redisPubClient
                .set(`group-${group.groupid}`, JSON.stringify(group))
                .catch();
        }
        // sql
        if (!service || service === "sql") {
            const ret = yield GROUPS.upsert(group).catch((err) => {
                console.log(err);
                console.log("--- writeGroup sql error ---", new Date().toString());
            });
        }
        // console.log('write group', group)
    });
}
exports.writeGroup = writeGroup;
function writeAnswer({ groupid, userid, chapter, k, answer, name, }, service) {
    return __awaiter(this, void 0, void 0, function* () {
        // redis
        const user = yield getUser({ userid, groupid, name });
        if (!user) {
            throw Error(`Can't find user ${userid} to write answer ${k}, ${answer}`);
        }
        if (!(chapter in user.answers)) {
            user.answers[chapter] = [];
        }
        user.answers[chapter][k] = answer;
        yield writeUser(user);
    });
}
exports.writeAnswer = writeAnswer;
function setFinished({ groupid, chapter, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const group = yield getGroup(groupid);
        if (!group.finished) {
            group.finished = [];
        }
        if (!group.finished.includes(chapter)) {
            group.finished.push(chapter);
        }
        yield writeGroup(group);
    });
}
exports.setFinished = setFinished;
function setUnFinished({ groupid, chapter, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const group = yield getGroup(groupid);
        if (!group.finished) {
            group.finished = [];
        }
        if (group.finished.includes(chapter)) {
            group.finished.splice(group.finished.indexOf(chapter), 1);
        }
        yield writeGroup(group);
    });
}
exports.setUnFinished = setUnFinished;
function setShowResults({ groupid, chapter, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const group = yield getGroup(groupid);
        if (!group.showResults) {
            group.showResults = [];
        }
        if (!group.showResults.includes(chapter)) {
            group.showResults.push(chapter);
        }
        yield writeGroup(group);
    });
}
exports.setShowResults = setShowResults;
function setUnShowResults({ groupid, chapter, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const group = yield getGroup(groupid);
        if (!group.showResults) {
            group.showResults = [];
        }
        if (group.showResults.includes(chapter)) {
            group.showResults.splice(group.showResults.indexOf(chapter), 1);
        }
        yield writeGroup(group);
    });
}
exports.setUnShowResults = setUnShowResults;
function setStartChapter({ groupid, chapter, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const group = yield getGroup(groupid);
        if (typeof group !== "object") {
            throw Error(`Group does not exist. Can not start chapter ${groupid}, ${chapter}`);
        }
        if (!group.started) {
            group.started = [];
        }
        if (!group.started.includes(chapter)) {
            group.started.push(chapter);
        }
        yield writeGroup(group);
    });
}
exports.setStartChapter = setStartChapter;
function setUnStartChapter({ groupid, chapter, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const group = yield getGroup(groupid);
        if (typeof group !== "object") {
            throw Error(`Group does not exist. Can not unstart chapter ${groupid}, ${chapter}`);
        }
        if (!group.started) {
            group.started = [];
        }
        if (group.started.includes(chapter)) {
            group.started.splice(group.started.indexOf(chapter), 1);
        }
        yield writeGroup(group);
    });
}
exports.setUnStartChapter = setUnStartChapter;
function setDone({ groupid, userid, chapter, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield getUser({ groupid, userid });
        if (!user.done) {
            user.done = [];
        }
        if (!user.done.includes(chapter)) {
            user.done.push(chapter);
        }
        yield writeUser(user);
    });
}
exports.setDone = setDone;
function setUnDone({ groupid, userid, chapter, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield getUser({ groupid, userid });
        if (!user.done) {
            user.done = [];
        }
        if (user.done.includes(chapter)) {
            user.done.splice(user.done.indexOf(chapter), 1);
        }
        yield writeUser(user);
    });
}
exports.setUnDone = setUnDone;
function writeComment({ text, groupid, userid, id, duration, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const commentObject = { text };
        if (groupid) {
            commentObject.groupid = groupid;
        }
        if (userid) {
            commentObject.userid = userid;
        }
        if (duration) {
            commentObject.duration = duration;
        }
        if (id) {
            commentObject.id = id;
        }
        const ret = yield COMMENTS.upsert(commentObject, { returning: ["*"] });
        // console.log('============')
        // console.log(ret)
        // console.log('============')
        return commentObject;
    });
}
exports.writeComment = writeComment;
function backup() {
    return __awaiter(this, void 0, void 0, function* () {
        const _models = [{ GROUPS }, { USERS }, { COMMENTS }];
        const exportData = [];
        for (let m in _models) {
            let tmpData = yield Object.values(_models[m])[0].findAll({
                paranoid: false,
            });
            if (tmpData) {
                tmpData = JSON.parse(JSON.stringify(tmpData));
            }
            let tmpobj = {
                name: Object.keys(_models[m])[0],
                data: tmpData || [],
            };
            //
            //
            exportData.push(tmpobj);
        }
        return exportData;
        // // place the file in the dir
        // const pad = `./backup/backup.json`;
        // return fs.writeFileSync(pad, JSON.stringify(exportData));
    });
}
exports.backup = backup;

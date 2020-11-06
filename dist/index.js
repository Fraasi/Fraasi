"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const core = __importStar(require("@actions/core"));
const graphql_1 = require("@octokit/graphql");
/** template strings */
var TPL_STR;
(function (TPL_STR) {
    TPL_STR["LANGUAGE_TEMPLATE_START"] = "LANGUAGE_TEMPLATE_START";
    TPL_STR["LANGUAGE_TEMPLATE_END"] = "LANGUAGE_TEMPLATE_END";
    TPL_STR["LANGUAGE_NAME"] = "LANGUAGE_NAME";
    TPL_STR["LANGUAGE_PERCENT"] = "LANGUAGE_PERCENT";
    TPL_STR["LANGUAGE_COLOR"] = "LANGUAGE_COLOR";
    TPL_STR["ACCOUNT_AGE"] = "ACCOUNT_AGE";
    TPL_STR["ISSUES"] = "ISSUES";
    TPL_STR["PULL_REQUESTS"] = "PULL_REQUESTS";
    TPL_STR["COMMITS"] = "COMMITS";
    TPL_STR["GISTS"] = "GISTS";
    TPL_STR["REPOSITORIES"] = "REPOSITORIES";
    TPL_STR["REPOSITORIES_CONTRIBUTED_TO"] = "REPOSITORIES_CONTRIBUTED_TO";
    TPL_STR["STARS"] = "STARS";
})(TPL_STR || (TPL_STR = {}));
run().catch(error => core.setFailed(error.message));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const token = process.env.TOKEN;
        const template = './TEMPLATE.md';
        const readme = './README.md';
        const gql = graphql_1.graphql.defaults({
            headers: { authorization: `token ${token}` },
        });
        const userInfo = yield getUserInfo(gql);
        const { accountAge, issues, pullRequests, contributionYears, gists, repositories, repositoryNodes, repositoriesContributedTo, stars, } = userInfo;
        const totalCommits = yield getTotalCommits(gql, contributionYears);
        let o = yield fs_1.promises.readFile(template, { encoding: 'utf8' });
        o = replaceLanguageTemplate(o, repositoryNodes);
        o = replaceStringTemplate(o, TPL_STR.ACCOUNT_AGE, accountAge);
        o = replaceStringTemplate(o, TPL_STR.ISSUES, issues);
        o = replaceStringTemplate(o, TPL_STR.PULL_REQUESTS, pullRequests);
        o = replaceStringTemplate(o, TPL_STR.COMMITS, totalCommits);
        o = replaceStringTemplate(o, TPL_STR.GISTS, gists);
        o = replaceStringTemplate(o, TPL_STR.REPOSITORIES, repositories);
        o = replaceStringTemplate(o, TPL_STR.REPOSITORIES_CONTRIBUTED_TO, repositoriesContributedTo);
        o = replaceStringTemplate(o, TPL_STR.STARS, stars);
        yield fs_1.promises.writeFile(readme, o);
    });
}
function getUserInfo(gql) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = `{
        viewer {
            createdAt
            issues {
                totalCount
            }
            pullRequests(first: 100, states: MERGED) {
              totalCount
              nodes{
                repository {
                  nameWithOwner
                }
              }
            }
            contributionsCollection {
                contributionYears
            }
            gists(first: 100) {
                totalCount
                nodes {
                    stargazers {
                        totalCount
                    }
                }
            }
            repositories(affiliations: OWNER, isFork: false, first: 100) {
                totalCount
                nodes {
                    stargazers {
                        totalCount
                    }
                    languages(first: 100) {
                        edges {
                            size
                            node {
                                color
                                name
                            }
                        }
                    }
                }
            }
            repositoriesContributedTo {
                totalCount
            }
        }
        rateLimit { cost remaining resetAt }
    }`;
        const { viewer: { createdAt, issues, pullRequests, contributionsCollection: { contributionYears }, gists, repositories, repositoriesContributedTo, }, } = yield gql(query);
        const accountAgeMS = Date.now() - new Date(createdAt).getTime();
        const accountAge = Math.floor(accountAgeMS / (1000 * 60 * 60 * 24 * 365.25));
        const stars = [...gists.nodes, ...repositories.nodes]
            .map(gist => gist.stargazers.totalCount)
            .reduce((total, current) => total + current, 0);
        const repositoriesContributedToForReal = pullRequests.nodes
            .reduce((set, obj) => {
            if (obj.repository.nameWithOwner.includes('Fraasi'))
                return set;
            return set.add(obj.repository.nameWithOwner);
        }, new Set())
            .size;
        return {
            accountAge,
            issues: issues.totalCount,
            pullRequests: pullRequests.totalCount,
            contributionYears,
            gists: gists.totalCount,
            repositories: repositories.totalCount,
            repositoryNodes: repositories.nodes,
            // repositoriesContributedTo: repositoriesContributedTo.totalCount,
            repositoriesContributedTo: repositoriesContributedToForReal,
            stars,
        };
    });
}
function getTotalCommits(gql, contributionYears) {
    return __awaiter(this, void 0, void 0, function* () {
        let query = '{viewer{';
        for (const year of contributionYears) {
            query += `_${year}: contributionsCollection(from: "${getDateTime(year)}") { totalCommitContributions }`;
        }
        query += '}}';
        const result = yield gql(query);
        return Object.keys(result.viewer)
            .map(key => result.viewer[key].totalCommitContributions)
            .reduce((total, current) => total + current, 0);
    });
}
function getDateTime(year) {
    const date = new Date();
    date.setUTCFullYear(year, 0, 1);
    date.setUTCHours(0, 0, 0, 0);
    return date.toISOString();
}
function buildRegex(name, newLine = false) {
    let str = `\\{\\{\\s*${name}(?::(?<opts>.+?))?\\s*\\}\\}`;
    if (newLine)
        str += '\n?';
    return new RegExp(str, 'g');
}
function getOptsMap(opts) {
    var _a, _b;
    const opt = new Map();
    for (const match of opts.matchAll(/(?<key>[^=;]+)(?:=(?<value>[^;]+))?/g)) {
        const key = (_a = match.groups) === null || _a === void 0 ? void 0 : _a.key;
        const value = (_b = match.groups) === null || _b === void 0 ? void 0 : _b.value;
        if (key)
            opt.set(key, value);
    }
    return opt;
}
function replaceStringTemplate(input, name, value) {
    return input.replace(buildRegex(name), (_, opts) => opts && getOptsMap(opts).has('uri')
        ? encodeURIComponent(value)
        : String(value));
}
function replaceLanguageTemplate(input, repositories) {
    var _a;
    const rStart = buildRegex(TPL_STR.LANGUAGE_TEMPLATE_START, true);
    const rEnd = buildRegex(TPL_STR.LANGUAGE_TEMPLATE_END, true);
    const replacements = [];
    for (const match of input.matchAll(rStart)) {
        if (match.index === undefined)
            continue;
        const opts = (_a = match.groups) === null || _a === void 0 ? void 0 : _a.opts;
        const max = (opts && Number(getOptsMap(opts).get('max'))) || 8;
        const end = match.index + match[0].length;
        const s = input.substring(end);
        const endMatch = s.search(rEnd);
        if (endMatch === -1)
            continue;
        const str = s.substring(0, endMatch);
        const replacement = getLanguages(repositories, max)
            .map(lang => {
            let res = str;
            res = replaceStringTemplate(res, TPL_STR.LANGUAGE_NAME, lang.name);
            res = replaceStringTemplate(res, TPL_STR.LANGUAGE_PERCENT, lang.percent);
            res = replaceStringTemplate(res, TPL_STR.LANGUAGE_COLOR, lang.color);
            return res;
        })
            .reduce((acc, parts) => acc + parts, '');
        replacements.push({
            start: end,
            end: end + endMatch,
            replacement,
        });
    }
    let output = '';
    let start = 0;
    for (const replacement of replacements) {
        output += input.substring(start, replacement.start);
        output += replacement.replacement;
        start = replacement.end;
    }
    output += input.substring(start, input.length);
    output = output.replace(rStart, '').replace(rEnd, '');
    return output;
}
function getLanguages(repositories, max) {
    const languages = new Map();
    for (const repo of repositories) {
        for (const lang of repo.languages.edges) {
            const existing = languages.get(lang.node.name);
            if (existing) {
                existing.size += lang.size;
            }
            else {
                languages.set(lang.node.name, {
                    name: lang.node.name,
                    size: lang.size,
                    percent: 0,
                    color: lang.node.color || '#ededed',
                });
            }
        }
    }
    const langs = [...languages.values()].sort((a, b) => b.size - a.size);
    const totalSize = langs.reduce((acc, lang) => acc + lang.size, 0);
    /** rounds x to 1 decimal place */
    const round = (x) => Math.floor(x * 10) / 10;
    const getPercent = (size) => round((size / totalSize) * 100);
    for (const lang of langs) {
        lang.percent = getPercent(lang.size);
    }
    let maxLanguages = max;
    // adjust maxLanguages based on languages that are under 0.1%
    const index = langs.findIndex(lang => lang.percent === 0);
    if (index !== -1) {
        maxLanguages = Math.min(maxLanguages, index + 1);
    }
    // aggregate removed languages under 'Other'
    if (maxLanguages < langs.length) {
        const size = langs
            .splice(maxLanguages - 1)
            .reduce((acc, lang) => acc + lang.size, 0);
        const percent = getPercent(size);
        if (percent !== 0) {
            langs.push({
                name: 'Other',
                size,
                percent,
                color: '#ededed',
            });
        }
    }
    return langs;
}

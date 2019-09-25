#!/usr/bin/env node

const git = require('simple-git')(process.cwd());
const blessed = require('blessed')

let screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    dockBorders: true,
    ignoreDockContrast: false,
    autoPadding: true,
    resizeTimeout: 100,
    sendFocus: true,
    title: 'vgit',
});


/* ================================================== *
 * =====================| MENU |===================== *
 * ================================================== */

let menu = blessed.Listbar({
    parent: screen,
    shrink: true,
    mouse: true,
    keys: true,
    vi: true,
    align: "center",
    valign: "middle",
    name: 'text',
    autoCommandKeys: true,
    border: {
        type: 'line',
        fg: 'lightcyan',
    },
    style: {
        selected: {
            bold: true,
            fg: 'blue',
            bg: 'black',
        },
        item: {
            fg: 'normal',
            bg: 'normal',
        },
        label: { fg: 'white' },
        focus: { border: { fg: 'cyan' }},
    },
    label: {
        text: 'Menu',
        side: 'left',
    },
    position: {
        top: 0,
        left: 1,
        width: '99%',
        height: 3,
    },
    items: {
        'Add': () => {
            addMenu.show();
            commitMenu.hide();
            remotetMenu.hide();
        },
        'Commit': () => {
            commitMenu.show();
            addMenu.hide();
            remotetMenu.hide();
        },
        'Remote': () => {
            remotetMenu.show();
            addMenu.hide();
            commitMenu.hide();
        },
    },
});

/* ====================================================== *
 * =====================| GET DATA |===================== *
 * ====================================================== */
let repoStatus;
const states = [
    'not_added',
    'deleted',
    'created',
    'modified',
    'renamed'
];

function getStatus() {
    git.status((err, data) => {
        // console.log('Status: ' + JSON.stringify(data));
        repoStatus = data;

        let toCommit = {};

        for (const state of states) {
            if(['not_added', 'modified'].includes(state)){
                if(addCheckboxes[state]){
                    for (let i = 0; i < addCheckboxes[state].length; i++) {
                        addCheckboxes[state][i].destroy();
                    }
                }

                addCheckboxes[state] = [];
            }

            if(state != 'not_added'){
                commitLists[state].clearItems();
            }


            let countAdd = 0;
            let countCommit = 0;

            for (let file of repoStatus[state]) {
                if(['created', 'deleted', 'renamed'].includes(state) ||
                    (state == 'modified' && repoStatus.staged.includes(file))){
                    if(state == 'renamed') { file = file.from + " -> " + file.to; }
                    commitLists[state].addItem(file);
                    countCommit++;
                } else {
                    addCheckboxes[state].push(blessed.checkbox({
                        parent: addForms[state],
                        mouse: true,
                        shrink: true,
                        content: file,
                        checked: false,
                        name: 'checkbox',
                        position: {
                            top: countAdd,
                            left: 1,
                            width: addForms[state].width - 4,
                            height: 1,
                        },
                        style: {
                            fg: 'blue',
                            bg: 'normal',
                            focus: { bg: 'lightblack' },
                            hover: { bg: 'lightblack' },
                        }
                    }));
                    countAdd++;
                }
            }
        }
        // For remote menu
        ahead.setContent('{bold}Ahead:{/} ' + repoStatus.ahead)
        behind.setContent('{bold}Behind:{/} ' + repoStatus.behind)
        current.setContent('{bold}Current:{/} ' + repoStatus.current)
        tracking.setContent('{bold}Tracking:{/} ' + repoStatus.tracking)

        getRemote();

        screen.render();
    });

}

let remoteURL;
function getRemote() {
    git.branch((err, data) => {
        branches = data.all;
        branchData = data.branches
        let contentBranch = [['Branch', 'Commit']]
        let indexBranch = -1;
        for (let i = 0, len = branches.length; i < len; i++) {
            let branchName = branches[i];
            if(!branchName.includes('remotes')){
                if(branchData[branchName].current){
                    indexBranch = i + 1;
                }
                contentBranch.push([branchData[branchName].name, branchData[branchName].commit]);
            }
        }
        branchList.setData(contentBranch)
        branchList.select(indexBranch)

    })

    git.getRemotes(true, (err, data) => {
        let remotes = data;
        let contentRemote = [['Name', 'URL']]
        let indexRemote = -1;
        for (let i = 0, len = data.length; i < len; i++) {
            if(remotes[i].name == repoStatus.tracking.split('/')[0]){
                indexRemote = i + 1;
                remoteURL = remotes[i].refs.push.split('//')[1];
            }
            contentRemote.push([remotes[i].name, remotes[i].refs.push]);
        }

        remoteList.setData(contentRemote)
        remoteList.select(indexRemote)
    })

    git.log((err, data) => {
        commits = data.all;
        let content = [['Message', 'Author', 'Date', 'Hash']]
        let indexCurrent = -1;
        for (let i = 0, len = commits.length; i < len; i++) {
            if(commits[i].hash == data.latest.hash){
                indexCurrent = i + 1;
            }
            content.push([
                commits[i].message.substring(0, Math.floor(commitList.width / 4)),
                commits[i].author_name,
                commits[i].date.slice(0, -6),
                commits[i].hash.substring(0,7)
            ])

        }
        commitList.setData(content)
        commitList.select(indexCurrent)
    })
}


/* ====================================================== *
 * =====================| ADD PANE |===================== *
 * ====================================================== */

let addCheckboxes = {};
let addForms = {};

let addMenu = blessed.form({
    parent: menu,
    label: {
        'text': 'Add',
        'side': 'left',
    },
    border: {
        type: 'line',
        fg: 'cyan',
    },
    style: {
        label: { fg: 'white', }
    },
    position: {
        top: 2,
        left: 'center',
        width: '100%',
        height: screen.height - 3,
    },
});

addForms['not_added'] = blessed.box({
    parent: addMenu,
    label: {
        'text': 'Untracked',
        'side': 'left',
    },
    border: {
        type: 'line',
        fg: 'cyan',
    },
    position: {
        top: 0,
        left: 0,
        width: 'half',
        height: '100%-5',
    },
});

addForms['modified'] = blessed.form({
    parent: addMenu,
    label: {
        'text': 'Modified',
        'side': 'left',
    },
    border: {
        type: 'line',
        fg: 'cyan',
    },
    position: {
        top: 0,
        left: '50%-1',
        width: 'half',
        height: '100%-5',
    },
});


let addToCommit = blessed.button({
    parent: addMenu,
    mouse: true,
    keys: true,
    shrink: true,
    padding: {
        left: 1,
        right: 1
    },
    content: 'Add to commit',
    border: {
        type: 'line',
        fg: 'green',
    },
    position: {
        bottom: 0,
        left: 'center',
        width: 'shrink',
        height: 3,
    },
    style: {
        fg: 'blue',
        bg: 'normal',
        focus: { bg: 'lightblack' },
        hover: { bg: 'lightblack' },
    }
});

addToCommit.on('press', () => {
    let names = [];


    for (const state of ['modified', 'not_added']) {
        for (let i = 0; i < addCheckboxes[state].length; i++) {
            if(addCheckboxes[state][i].checked){
                names.push(addCheckboxes[state][i].text);
            }
        }
    }

    git.add(names, (err, data) => {
        getStatus();
        screen.render();
    });

});

/* ========================================================= *
 * =====================| COMMIT PANE |===================== *
 * ========================================================= */

let commitLists = {};

let commitMenu = blessed.form({
    parent: menu,
    label: {
        'text': 'Commit',
        'side': 'left',
    },
    border: {
        type: 'line',
        fg: 'cyan',
    },
    style: {
        label: { fg: 'white', }
    },
    position: {
        top: 2,
        left: 'center',
        width: '100%',
        height: screen.height - 3,
    },
});

commitLists['renamed'] = blessed.list({
    parent: commitMenu,
    label: {
        'text': 'Renamed',
        'side': 'left',
    },
    border: {
        type: 'line',
        fg: 'cyan',
    },
    position: {
        top: 0,
        left: 0,
        width: 'half',
        height: '50%-2',
    },
    item: [],
});

commitLists['created'] = blessed.list({
    parent: commitMenu,
    label: {
        'text': 'Created',
        'side': 'left',
    },
    border: {
        type: 'line',
        fg: 'cyan',
    },
    position: {
        top: commitLists['renamed'].height - 1,
        left: 0,
        width: 'half',
        height: '50%-2',
    },
    item: [],
});

commitLists['modified'] = blessed.list({
    parent: commitMenu,
    label: {
        'text': 'Modified',
        'side': 'left',
    },
    border: {
        type: 'line',
        fg: 'cyan',
    },
    position: {
        top: 0,
        left: '50%-1',
        width: 'half',
        height: '50%-2',
    },
    item: [],
});

commitLists['deleted'] = blessed.list({
    parent: commitMenu,
    label: {
        'text': 'Deleted',
        'side': 'left',
    },
    border: {
        type: 'line',
        fg: 'cyan',
    },
    position: {
        top: commitLists['modified'].height - 1,
        left: '50%-1',
        width: 'half',
        height: '50%-2',
    },
    item: [],
});

let doCommit = blessed.button({
    parent: commitMenu,
    mouse: true,
    keys: true,
    shrink: true,
    padding: {
        left: 1,
        right: 1
    },
    content: 'Commit',
    border: {
        type: 'line',
        fg: 'green',
    },
    position: {
        bottom: 0,
        left: 0,
        width: 'shrink',
        height: 3,
    },
    style: {
        fg: 'blue',
        bg: 'normal',
        focus: { bg: 'lightblack' },
        hover: { bg: 'lightblack' },
    }
});

let commitMessage = blessed.Textbox({
    parent: commitMenu,
    name: 'textbox',
    mouse: true,
    shrink: true,
    inputOnFocus: true,
    input: true,
    padding: {
        left: 1,
        right: 1,
    },
    border: {
        type: 'line',
        fg: 'lightcyan',
    },
    position: {
        bottom: 0,
        left: 10,
        width: commitMenu.width - 10 - 2,
        height: 3,
    },
    label: {
        'text': 'Commit message',
        'side': 'left',
    },
    style: {
        fg: 'blue',
        bg: 'black',
        focus: {
            bg: 'lightblack',
            border: { fg: "magenta" },
        },
        hover: { bg: 'lightblack' },
    }
});

doCommit.on('press', () => {

    git.commit(commitMessage.getValue(), (err, data) => {
        getStatus();
        screen.render();
    });

});

/* ========================================================= *
 * =====================| REMOTE PANE |===================== *
 * ========================================================= */

let remotetMenu = blessed.form({
    parent: menu,
    label: {
        'text': 'Remote',
        'side': 'left',
    },
    border: {
        type: 'line',
        fg: 'cyan',
    },
    style: {
        label: { fg: 'white', }
    },
    position: {
        top: 2,
        left: 'center',
        width: '100%',
        height: screen.height - 3,
    },
});

let branches = [];
let branchList = blessed.ListTable({
    parent: remotetMenu,
    mouse: true,
    keys: true,
    vi: true,
    align: "center",
    valign: "middle",
    search: true,
    interactive: true,
    noCellBorder: false,
    border: {
        type: 'line',
        fg: 'lightcyan',
    },
    position: {
        top: 0,
        left: 0,
        height: 10,
        width: '30%',
    },
    label: {
        'text': 'Branches',
        'side': 'left',
    },
    style: {
        bg: "normal",
        fg: "normal",
        border: {
            type: 'line',
            fg: 'lightcyan',
        },
        header: {
            bold: true,
            underline: true,
            fg: 'blue',
        },
        cell: {
            fg: 'normal',
            bg: 'normal',
            selected: {
                bold: true,
                fg: 'blue',
                bg: 'black',
            },
            item: {
                fg: 'normal',
                bg: 'normal',
            },
        },
        focus: { border: { fg: 'cyan' },
        },
    },
    data: [
        ['Name', 'Commit'],
    ],
});

let remoteList = blessed.ListTable({
    parent: remotetMenu,
    mouse: true,
    keys: true,
    vi: true,
    align: "center",
    valign: "middle",
    search: true,
    interactive: true,
    noCellBorder: false,
    border: {
        type: 'line',
        fg: 'lightcyan',
    },
    position: {
        top: branchList.height,
        left: 0,
        height: 10,
        width: '30%',
    },
    label: {
        'text': 'Remotes',
        'side': 'left',
    },
    style: {
        bg: "normal",
        fg: "normal",
        border: {
            type: 'line',
            fg: 'lightcyan',
        },
        header: {
            bold: true,
            underline: true,
            fg: 'blue',
        },
        cell: {
            fg: 'normal',
            bg: 'normal',
            selected: {
                bold: true,
                fg: 'blue',
                bg: 'black',
            },
            item: {
                fg: 'normal',
                bg: 'normal',
            },
        },
        focus: { border: { fg: 'cyan' },
        },
    },
    data: [
        ['Remotes', 'Branch', 'Commit'],
    ],
});


let commits = [];
let commitList = blessed.ListTable({
    parent: remotetMenu,
    mouse: true,
    keys: true,
    vi: true,
    align: "center",
    valign: "middle",
    search: true,
    interactive: true,
    noCellBorder: false,
    border: {
        type: 'line',
        fg: 'lightcyan',
    },
    position: {
        top: 0,
        right: 0,
        height: '100%-2',
        width: '70%-1',
    },
    label: {
        'text': 'Commits',
        'side': 'left',
    },
    style: {
        bg: "normal",
        fg: "normal",
        border: {
            type: 'line',
            fg: 'lightcyan',
        },
        header: {
            bold: true,
            underline: true,
            fg: 'blue',
        },
        cell: {
            fg: 'normal',
            bg: 'normal',
            selected: {
                bold: true,
                fg: 'blue',
                bg: 'black',
            },
            item: {
                fg: 'normal',
                bg: 'normal',
            },
        },
        focus: { border: { fg: 'cyan' },
        },
    },
    data: [
        ['Message', 'Author', 'Date', 'Hash'],
    ],
});

let info = blessed.form({
    parent: remotetMenu,
    name: 'form',
    mouse: true,
    keys: true,
    vi: true,
    tags: true,
    align: 'center',
    border: {
        type: 'line',
        fg: 'lightcyan', }, style: {
        bg: "normal",
        fg: "normal",
        focus: { border: { fg: "cyan" } },
    },
    label: {
        text: 'Info',
        side: 'left',
    },
    position: {
        top: remoteList.height + branchList.height,
        left: 0,
        width: '30%',
        height: 6,
    },
});

var ahead = blessed.text({
    parent: info,
    name: 'text',
    tags: true, // Enable tags (bold, colors, etc) for text
    mouse: true,       // For scrolling
    keys: true,        // For scrolling
    vi: true,          // For scrolling
    content: 'Ahead: ',
    style: {
        bg: "normal",
        fg: "normal",
        focus: { border: { fg: "cyan" } },
        label: { fg: 'white', }
    },
    position: {
        top: 0,
        left: 0,
        width: '100%-2',
        height: 1,
    },
});

var behind = blessed.text({
    parent: info,
    name: 'text',
    tags: true, // Enable tags (bold, colors, etc) for text
    mouse: true,       // For scrolling
    keys: true,        // For scrolling
    vi: true,          // For scrolling
    content: 'Behind: ',
    style: {
        bg: "normal",
        fg: "normal",
        focus: { border: { fg: "cyan" } },
        label: { fg: 'white', }
    },
    position: {
        top: 1,
        left: 0,
        width: '100%-2',
        height: 1,
    },
});

var current = blessed.text({
    parent: info,
    name: 'text',
    tags: true, // Enable tags (bold, colors, etc) for text
    mouse: true,       // For scrolling
    keys: true,        // For scrolling
    vi: true,          // For scrolling
    content: 'Current: ',
    style: {
        bg: "normal",
        fg: "normal",
        focus: { border: { fg: "cyan" } },
        label: { fg: 'white', }
    },
    position: {
        top: 2,
        left: 0,
        width: '100%-2',
        height: 1,
    },
});

var tracking = blessed.text({
    parent: info,
    name: 'text',
    tags: true, // Enable tags (bold, colors, etc) for text
    mouse: true,       // For scrolling
    keys: true,        // For scrolling
    vi: true,          // For scrolling
    content: 'Tracking: ',
    style: {
        bg: "normal",
        fg: "normal",
        focus: { border: { fg: "cyan" } },
        label: { fg: 'white', }
    },
    position: {
        top: 3,
        left: 0,
        width: '100%-2',
        height: 1,
    },
});

let auth = blessed.form({
    parent: remotetMenu,
    name: 'form',
    mouse: true,
    keys: true,
    vi: true,
    tags: true,
    align: 'center',
    style: {
        bg: "normal",
        fg: "normal",
    },
    position: {
        bottom: 0,
        left: 0,
        width: '30%',
        height: 7,
    },
});

let username = blessed.Textbox({
    parent: auth,
    mouse: true,
    shrink: true,
    inputOnFocus: true,
    input: true,
    padding: {
        left: 1,
        right: 1,
    },
    border: {
        type: 'line',
        fg: 'lightcyan',
    },
    position: {
        top: 0,
        left: 0,
        width: '100%-2',
        height: 3,
    },
    label: {
        'text': 'Username',
        'side': 'left',
    },
    style: {
        fg: 'blue',
        bg: 'black',
        focus: {
            bg: 'lightblack',
            border: { fg: "magenta" },
        },
        hover: { bg: 'lightblack' },
    }
});

let password = blessed.Textbox({
    parent: auth,
    mouse: true,
    shrink: true,
    inputOnFocus: true,
    input: true,
    censor: true,
    padding: {
        left: 1,
        right: 1,
    },
    border: {
        type: 'line',
        fg: 'lightcyan',
    },
    position: {
        bottom: 0,
        left: 0,
        width: '100%-2',
        height: 3,
    },
    label: {
        'text': 'Password',
        'side': 'left',
    },
    style: {
        fg: 'blue',
        bg: 'black',
        focus: {
            bg: 'lightblack',
            border: { fg: "magenta" },
        },
        hover: { bg: 'lightblack' },
    }
});

let push = blessed.button({
    parent: remotetMenu,
    name: 'submit',
    mouse: true,
    keys: true,
    align: 'center',
    padding: {
        left: 1,
        right: 1
    },
    name: 'submit',
    content: 'Push',
    border: {
        type: 'line',
        fg: 'green',
    },
    position: {
        top: '60%',
        left: '7.5%',
        width: '15%',
        height: 3,
    },
    style: {
        fg: 'blue',
        bg: 'normal',
        focus: { bg: 'lightblack' },
        hover: { bg: 'lightblack' },
    }
});

let pull = blessed.button({
    parent: remotetMenu,
    name: 'submit',
    mouse: true,
    keys: true,
    align: 'center',
    padding: {
        left: 1,
        right: 1
    },
    name: 'submit',
    content: 'Pull',
    border: {
        type: 'line',
        fg: 'green',
    },
    position: {
        top: '70%',
        left: '7.5%',
        width: '15%',
        height: 3,
    },
    style: {
        fg: 'blue',
        bg: 'normal',
        focus: { bg: 'lightblack' },
        hover: { bg: 'lightblack' },
    }
});

push.on('press', function() {
    git.push('https://' + username.getContent() + ':' + encodeURIComponent(password.value) + '@' + remoteURL,
        repoStatus.current, (err, data) => {
        remoteMessage.log('Push completed', () => {})
        getStatus();
    });
});

pull.on('press', function() {
    git.pull('https://' + username.getContent() + ':' + encodeURIComponent(password.value) + '@' + remoteURL,
        repoStatus.current, (err, data) => {
        remoteMessage.log('Pull completed', () => {})
        getStatus();
    });
});

var remoteMessage = blessed.message({
    hidden: true,
    parent: remotetMenu,
    shrink: true,
    align: "center",
    border: {
        type: 'line',
        fg: 'yellow',
    },
    style: {
        bg: "black",
        fg: "blue",
    },
    position: {
        bottom: 0,
        left: 0,
        width: '30%',
        height: '15%',
    },
});

addMenu.show()
commitMenu.hide();
remotetMenu.hide();

screen.key('q', function() {
    process.exit(0);
});


getStatus();


screen.render();

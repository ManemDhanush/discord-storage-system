const upload = require('../api/discord/upload.js');
const download = require('../api/discord/download.js');

function commandLineArguments(argv) {
    const uploadIndex = argv.findIndex((arg) => {
        return (arg === "-u" || arg === "--upload") ? true : false;
    });

    if (uploadIndex > -1) {
        const filePath = argv[uploadIndex + 1];
        const title = argv[uploadIndex + 2];
        upload(filePath, title);

        return;
    }

    const downloadIndex = argv.findIndex((arg) => {
        return (arg === "-d" || arg === "--download") ? true : false;
    });

    if (downloadIndex > -1) {
        const title = argv[downloadIndex + 1];
        download(title);

        return;
    }

}

module.exports = commandLineArguments
import upload from '../api/discord/upload.js';
import download from '../api/discord/download.js';

function commandLineArguments(argv) {
    const uploadIndex = argv.findIndex((arg) => {
        return (arg === "-u" || arg === "--upload") ? true : false;
    });

    if (uploadIndex > -1) {
        const filePath = argv[uploadIndex + 1];
        upload(filePath);

        return;
    }

    const downloadIndex = argv.findIndex((arg) => {
        return (arg === "-d" || arg === "--download") ? true : false;
    });

    if (downloadIndex > -1) {
        const filePath = argv[downloadIndex + 1];
        download(filePath);

        return;
    }

}

export default commandLineArguments;
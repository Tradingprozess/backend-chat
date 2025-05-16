const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require("uuid");


const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const BUCKET = process.env.AWS_BUCKET;

async function uploadToS3(file) {
    try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const key = `${Date.now()}-${file.name}`;
        await s3.send(
            new PutObjectCommand({
                Bucket: BUCKET,
                Key: key,
                Body: buffer,
                ContentType: file.type,
            })
        );
        return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    } catch (err) {
        console.error('Error uploading to S3:', err);
        return null;
    }
}


async function uploadToS3FromBase64(base64Data, fileName = uuidv4() + '_image.png') {
    try {
        const parsedImage = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(parsedImage, 'base64');

        const key = `uploads/${Date.now()}-${fileName}`;

        await s3.send(
            new PutObjectCommand({
                Bucket: BUCKET,
                Key: key,
                Body: buffer,
                ContentType: fileName?.split('.').pop(),
            })
        );

        return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    } catch (err) {
        console.error('Error uploading base64 image to S3:', err);
        return null;
    }
}

module.exports = {
    s3,
    BUCKET,
    uploadToS3,
    uploadToS3FromBase64
}
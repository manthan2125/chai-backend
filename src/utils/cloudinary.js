import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        // upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        });
        // console.log("Response: ", response);
        /*
        Response:  {
  asset_id: '0c477f0939a19450daa2487e3f4d216c',
  public_id: 'u80sogx9g9v00wtm4cmu',
  version: 1785323291,
  version_id: '33394756032a2f6f560ed1e07b2ec15f',
  signature: 'cd67a8616e82bb581eb1b25ca2a330c3221ac850',
  width: 316,
  height: 632,
  format: 'jpg',
  resource_type: 'image',
  created_at: '2026-07-29T11:08:11Z',
  tags: [],
  bytes: 33212,
  type: 'upload',
  etag: '2c4f1000aaafc4f2699a4acba4d28b49',
  placeholder: false,
  url: 'http://res.cloudinary.com/gkrorom9/image/upload/v1785323291/u80sogx9g9v00wtm4cmu.jpg',
  secure_url: 'https://res.cloudinary.com/gkrorom9/image/upload/v1785323291/u80sogx9g9v00wtm4cmu.jpg',
  asset_folder: '',
  display_name: 'u80sogx9g9v00wtm4cmu',
  original_filename: 'deadpool',
  original_extension: 'jfif',
  api_key: '957669688716495'
}
        */

        // file has been uploaded successfully
        // console.log("File is uploaded on cloudinary", response.url);
        fs.unlinkSync(localFilePath)
        return response;
    }
    catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
        return null
    }
}

export { uploadOnCloudinary }
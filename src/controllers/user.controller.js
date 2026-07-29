import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { userModel } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from 'jsonwebtoken';
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => 
{
    try{
        const user = await userModel.findById(userId);
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false});

        return { accessToken, refreshToken}
    }
    catch(err){
        throw new ApiError(500, "Something went wrong while generating access and refresh tokens")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    //check if user already exists : username email
    // check for images, check for avatar
    //upload them to cloudinary, avatar
    // create user object - create entry in db
    //remove password and refresh token in field from response
    //return res 

    const {username, email, fullName, password} = req.body;
    // validation - not empty
    if( 
        [username, fullName, email, password].some(function(field){
            return field?.trim() === ""
         })
    ){
        throw new ApiError(400, "All fields are required")
    }

   const existedUser = await userModel.findOne({
        $or : [ {email} , {password}]
    });

    if(existedUser){
        throw new ApiError(409, "User with email or username already exists")
    }

    // console.log("req.files : ",req.files)  
    /*  
    req.files : {
  avatar: [
    {
      fieldname: 'avatar',
      originalname: '_MG_2035.JPG',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      path: 'public\\temp\\_MG_2035.JPG',
      destination: './public/temp',
      filename: '_MG_2035.JPG',
      size: 5979017
    }
  ],
  coverImage: [
    {
      fieldname: 'coverImage',
      originalname: 'deadpool.jfif',
      encoding: '7bit',
      mimetype: 'application/octet-stream',
      path: 'public\\temp\\deadpool.jfif',
      destination: './public/temp',
      filename: 'deadpool.jfif',
      size: 33212
    }
  ]
}
  */

    // console.log("req.body : ", req.body)
    // console.log("req.files : ", req.files)

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImagePath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path; 
    }


    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);    // it is returning response - but response.url constains the url
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    // console.log("Avatar : ", avatar);
    // console.log("coverImage", coverImage);
    
    
    
    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await userModel.create({
        username: username.toLowerCase(),
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password
    })

    const createdUser =await  userModel.findById(user._id).select("-password -refreshToken")

    if(!createdUser){
        throw new ApiError(500, "something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered Successfully")
    )
});

const loginUser = asyncHandler( async (req, res) => {
    // req.body -> data 
    //  username or email
    // find the user 
    // password check
    // access and refresh token
    //  send cookies

    const { username, email, password } = req.body;

    if( !username && !email ){
        throw new ApiError(400, "Username or email is required")
    }

    const user = await userModel.findOne({
        $or: [{username}, {email}]
    })
    
    if(!user){
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials");
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);
    // Isse upr tak humne jo user login krne aa rha h db mein iss email or username ka user hai ya nahi.
    // Fir uss user ka password validate kiya or uska refreshToken db mein save kraya and generate kraya sab.
   
    const loggedInUser = await userModel.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In successfully"
        ) 
    )

});

const logoutUser = asyncHandler(async (req, res) => {
    const user = req.user;
    await userModel.findByIdAndUpdate(
        user._id,
        {
            $set: {
                refreshToken : undefined
            }
        },
        {
            // ye smjh nahi aaya
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out succesfully"))
})
// Generating AccessToken wwiht the help of refresh token
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorised request")
    }

    try{
        const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_ACCESS_SECRET
    )

    const user =  await userModel.findById(decodedToken?._id)

    if(!user){
        throw new ApiError(401, "Invalid refresh token")
    }

    if(incomingRefreshToken !== user?.refreshToken){
        throw new ApiError(401, "Refresh token is expired or used")
    }

    const options = {
        httpOnly: true,
        secure: true
    }

    const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
        new ApiResponse(
            200,
            {accessToken, refreshToken: newRefreshToken},
            "Message token refreshed"
        )
    )
    }
    catch(err){
        throw new ApiError(401, err?.message || "Invalid Refresh Token")
    }

})

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await userModel.findById(req.user?._id);
    const isPasswordValid = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordValid){
        throw new ApiError(400, "Invalid Old Password")
    }

    user.password = newPassword;
    await user.save({validateBeforeSave : false})

    return res
    .status(200)
    .json(new ApiResponse(200,{}, "Passsword changes successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body;

    if(!fullName || !email){
        throw new ApiError(400, "All fileds are required")
    }

    const user = await userModel.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                fullName : fullName,
                email
            }
        },
        {new: true}  // update hone ke baad updatedUser return hoga user var ke andar
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))


})

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path;
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)  // this avatar is an object returned by uploadOnCloudinary 
    if(!avatar.url){
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await userModel.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password -refreshToken")

     return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"))

})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path;
    if(!coverImageLocalPath){
        throw new ApiError(400, "CoverImage file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)  // this avatar is an object returned by uploadOnCloudinary 
    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading on coverImage")
    }

    const user = await userModel.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password -refreshToken")
    
    return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image updated successfully"))
})


export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
 }
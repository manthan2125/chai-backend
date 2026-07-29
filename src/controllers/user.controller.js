import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { user } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from "../utils/ApiResponse.js";

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

   const existedUser = await user.findOne({
        $or : [ {email} , {password}]
    });

    if(existedUser){
        throw new ApiError(409, "User with email or username already exists")
    }

    console.log(req.files)
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImagePath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);    // it is returning response - but response.url constains the url
    const coverImage = await uploadOnCloudinary(coverImagePath);

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user = user.create({
        username: username.toLowerCase(),
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password
    })

    const createdUser =await  user.findById(user._id).select("-password -refreshToken")

    if(!createdUser){
        throw new ApiError(500, "something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered Successfully")
    )
})


export { registerUser }
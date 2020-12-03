const User = require("../models/user");
const UserAiId = require("../models/userAiId");

const lodash = require("lodash"); // for updating fields

const { errorHandler } = require("../helpers/dbErrorHandler");
const jwt = require("jsonwebtoken"); // to generate signin token
const expressJwt = require("express-jwt"); // for authorization check
const { body, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");

exports.createAIUser = (req, res) => {
  const user = new User();

  let aiId = uuidv4();
  console.log("ai user ai id", aiId);
  user.aiId = aiId;

  user.status = 0;
  user.save((err, user) => {
    if (err) {
      return res.status(400).json({
        error: errorHandler(err),
      });
    }
    const userAiId = new UserAiId();
    userAiId.aiId = aiId;
    userAiId.verified = 0;

    userAiId.save((err, user) => {
      if (err) {
        return res.status(400).json({
          error: errorHandler(err),
        });
      }
      res.json({
        user,
      });
    });
  });
};
exports.saveUser = (req, res, next) => {
  console.log("req.body", req.body);

  const { aiId, phoneNumber } = req.body;

  if (phoneNumber) {
    User.findOne({ phoneNumber }, (err, user) => {
      if (err) {
        return res.status(400).json({
          error: errorHandler(err),
        });
      }

      if (!user) {
        User.findOne({ aiId }, (err, user) => {
          if (err || !user) {
            return res.status(400).json({
              error: "user not found with aiId:" + err,
            });
          }

          user = lodash.extend(user, req.body);
          user.save((err, user) => {
            if (err) {
              return res.status(400).json({
                error: errorHandler(err),
              });
            }
            user.salt = undefined;
            user.hashed_password = undefined;
            req.user = user;

            UserAiId.findOne({ aiId }, (err, aiIdUser) => {
              if (err || !aiIdUser) {
                return res.status(400).json({
                  error: "user not found with aiId:" + err,
                });
              }

              aiIdUser.userId = phoneNumber;
              aiIdUser.save((err, aiIdUser) => {
                if (err) {
                  return res.status(400).json({
                    error: errorHandler(err),
                  });
                }

                next();
              });
            });
          });
        });
      } else {
        return res.status(400).json({
          error: "User already exist.",
        });
      }
    });
  } else {
    return res.status(400).json({
      error: "Sigin up using only phone number",
    });
  }
};
exports.signup = (req, res) => {
  res.json({
    user: req.user,
  });
};

exports.pullUser = (req, res, next) => {
  //find the user based on phoneNumber
  const { phoneNumber, aiId } = req.body;
  if (phoneNumber) {
    User.findOne({ phoneNumber }, (err, user) => {
      if (err || !user) {
        return res.status(400).json({
          error: "User dose not exist. Please signup",
        });
      }

      if (user.verified) {
        // verified user
        UserAiId.findOne({ aiId }, (err, aiIdUser) => {
          if (err || !aiIdUser) {
            return res.status(400).json({
              error: "user not found with aiId:" + err,
            });
          }

          if (aiId.verified) {
            // verified user old machine
          } else {
            // verified user new machine
          }
        });
      } else {
        // signed up user but not verified
      }

      //const user = new User;
      //user.purr();
      // if user is is found make sure phoneNumber and password matched
      //Create authenticate method in user model
      //user1 = new User;
      // if (!user.authenticate(password)) {
      //   return res.status(401).json({
      //     error: "User not found",
      //   });
      // }

      if (user.verified === 1) {
        // only verified user will recived token
        //generate a signed token with user id and secrate
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
        // persist the token as 't' in cookie with expriy date
        res.cookie("t", token, { expire: new Date() + 9999 }); // here 9999 in seconds
        // Now return response with user and token to frontend client
        req.token = token;
      }

      req.user = user;
      console.log("pull user:", user);
      next();
    });
  } else {
    return res.status(400).json({
      error: "Signin only using phone number",
    });
  }
};
exports.signin = (req, res) => {
  const {
    _id,
    name,
    phoneNumber,
    role,
    verified,
    aiId,
    passwordProtected,
    status,
  } = req.user;
  let otpSent = undefined;
  if (req.otpSent) {
    otpSent = true;
  }
  res.json({
    otpSent,
    token: req.token,
    user: {
      _id,
      name,
      phoneNumber,
      role,
      verified,
      aiId,
      passwordProtected,
      status,
      aiId,
    },
  });
};
// exports.signin = (req, res)=>{
//     //find the user based on userId
//     const {userId, password} = req.body;
//     User.findOne({userId},(err, user)=>{
//         if (err || !user){
//             return res.status(400).json({
//                 error: 'User dose not exist. Please signup'
//             })
//         }

//         //const user = new User;
//     //user.purr();
//     // if user is is found make sure userId and password matched
//     //Create authenticate method in user model
//     //user1 = new User;
//     if (!user.authenticate(password)){
//         return res.status(401).json({
//             error: 'User not found'
//         })
//     }
//     //generate a signed token with user id and secrate
//     const token = jwt.sign({_id:user._id}, process.env.JWT_SECRET);
//     // persist the token as 't' in cookie with expriy date
//     res.cookie('t', token, {expire: new Date() + 9}) ; // here 9999 in seconds
//     // Now return response with user and token to frontend client
//     const {_id, name, role, verified} = user;
//     return res.json({token, user:{_id, name, userId, role, verified}});

//     });
// }
exports.signout = (req, res) => {
  res.clearCookie("t");
  res.json({
    message: "Signout successfully",
  });
};

exports.requireSignin = expressJwt({
  secret: process.env.JWT_SECRET,
  algorithms: ["HS256"], // added later
  userProperty: "auth", // all user property will be accessiable by auth object
});

exports.isAuth = (req, res, next) => {
  let user = req.profile && req.auth && req.profile._id == req.auth._id;
  if (!user) {
    return res.status(403).json({
      error: "Access denied.",
    });
  }

  next();
};

exports.isAdmin = (req, res, next) => {
  if (req.profile.role == 0) {
    // role 0 is for regular user, not for admin
    return res.status(403).json({
      error: "Admin resourse! Access denied",
    });
  }
  next();
};

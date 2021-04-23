onst { json, send } = require("micro");
const connect = require("./db");
const { parse } = require("url");
const ObjectId = require("mongodb").ObjectId;
const cors = require("micro-cors")();
const stripe = require("stripe")(process.env.STRIPE_SECRET_DEV);
const { wrapAsync } = require("../handlers/lib");

const createAccountApi = wrapAsync(async function(req, db) {
  const data = await json(req);
  const user = data.data;
  const getImage = (url, callback) => {
    https.get(url, res => {
      // Initialise an array
      const bufs = [];

      // Add the data to the buffer collection
      res.on("data", function(chunk) {
        bufs.push(chunk);
      });

      // This signifies the end of a request
      res.on("end", function() {
        // We can join all of the 'chunks' of the image together
        const data = Buffer.concat(bufs);

        // Then we can call our callback.
        callback(null, data);
      });
    });
    // Inform the callback of the error.
  };

  const accountToken = async () => {
    return new Promise(async function(resolve, reject) {
      await stripe.tokens.create(
        {
          account: {
            individual: {
              first_name: user.accountSettings.firstName,
              last_name: user.accountSettings.lastName
            },
            tos_shown_and_accepted: true
          }
        },
        function(err, token) {
          // asynchronously called
          resolve(token);
        }
      );
    });
  };
  const companyAccount = async () => {
    return new Promise(async function(resolve, reject) {
      await stripe.account.create(
        {
          type: "custom",
          country: "US",
          email: user.email,
          requested_capabilities: ["card_payments", "transfers"],
          tos_acceptance: {
            date: Math.floor(Date.now() / 1000),
            ip: req.ip // Assumes you're not using a proxy
          },
          business_type: "company",
          business_profile: {
            mcc: 7929,
            url: "http://www.whatstba.com"
          },
          company: {
            address: {
              state: user.accountSettings.state,
              city: user.accountSettings.city,
              postal_code: user.accountSettings.zipCode,
              line1: user.accountSettings.homeAddress,
              line2: user.accountSettings.homeAddress2
            },
            name: user.accountSettings.name,
            phone: user.accountSettings.phoneNumber.split(" ").join(""),
            tax_id: user.accountSettings.taxId
          },
          email: user.email
        },
        function(err, acc) {
          // asynchronously called
          if (err) {
            console.log(err);
            reject(err);
          }
          resolve(acc);
        }
      );
    });
  };
  const individualAccount = async () => {
    return new Promise(async function(resolve, reject) {
      await stripe.account.create(
        {
          type: "custom",
          country: "US",
          email: user.email,
          requested_capabilities: ["card_payments", "transfers"],
          tos_acceptance: {
            date: Math.floor(Date.now() / 1000),
            ip: req.ip // Assumes you're not using a proxy
          },
          business_type: "individual",
          business_profile: {
            mcc: 7929,
            url: "http://www.whatstba.com"
          },
          individual: {
            first_name: user.accountSettings.firstName,
            last_name: user.accountSettings.lastName,
            id_number: user.accountSettings.lastFourSSN,
            address: {
              state: user.accountSettings.state,
              city: user.accountSettings.city,
              postal_code: user.accountSettings.zipCode,
              line1: user.accountSettings.homeAddress,
              line2: user.accountSettings.homeAddress2
            },
            dob: {
              day: user.accountSettings.dob.split("/")[1],
              month: user.accountSettings.dob.split("/")[0],
              year: user.accountSettings.dob.split("/")[2]
            },
            email: user.email,
            phone: user.accountSettings.phoneNumber.split(" ").join("")
          }
        },
        function(err, acc) {
          // asynchronously called
          if (err) {
            console.log(err);
            reject(err);
          }
          resolve(acc);
        }
      );
    });
  };
  const connectBankInfo = async userAcc => {
    console.log("bank", userAcc);
    return new Promise(async function(resolve, reject) {
      await stripe.accounts.createExternalAccount(
        userAcc.id,
        {
          external_account: {
            object: "bank_account",
            routing_number: user.accountSettings.routingNumber,
            account_number: user.accountSettings.accountNumber,
            currency: "USD",
            country: "US",
            account_holder_name: user.accountSettings.firstName,
            account_holder_type: user.accountSettings.acccountType
          }
        },
        function(err, acc) {
          // asynchronously called
          if (err) {
            console.log(err);
            reject(err);
          }
          resolve(acc);
        }
      );
    });
  };
  const updateAccount = async account => {
    return new Promise(async function(resolve, reject) {
      await stripe.accounts.retrieve(account.id, function(err, acc) {
        // asynchronously called
        if (err) {
          console.log(err);
          reject(err);
        }
        resolve(acc);
      });
    });
  };
  const id = async data => {
    return new Promise(function(resolve, reject) {
      stripe.files.create(
        {
          purpose: "identity_document",
          file: {
            data: data,
            name: "file_name.jpg",
            type: "application/octet-stream"
          }
        },
        { stripe_account: CONNECTED_STRIPE_ACCOUNT_ID }
      );
    });
  };

  if (!user.stripe) {
    let userAcc = null;
    if (user.accountType === "individual") {
      userAcc = await individualAccount();
    } else {
      userAcc = await companyAccount();
    }
    await connectBankInfo(userAcc);
    userAcc = await updateAccount(userAcc);
    user.stripe = userAcc;
    console.log("acc", userAcc);
  }

  return updateUser(newUser, db);
});
module.exports = {
  userApi: cors(userApi),
  userQueryApi: cors(userQueryApi),
  createAccountApi: cors(createAccountApi)
};

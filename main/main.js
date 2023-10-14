import { ethers } from "../ethers-5.6.esm.min.js"
import { abi, contractAddress } from "../constants.js"
import { delt_abi, delt_contractAddress } from "../delt_constants.js"

const connectButton = document.getElementById("connectButton")
const addCourseButton = document.getElementById("addCourseButton")
const showCoursesButton = document.getElementById("showCoursesButton")

const addToPoolButton = document.getElementById("addToPoolButton")
const showPoolButton = document.getElementById("showPoolButton")
const eventLog = document.getElementById("eventLog")

connectButton.onclick = connect
addCourseButton.onclick = addCourse
addToPoolButton.onclick = increaseMatchingPool
showPoolButton.onclick = showMatchingPool
showCoursesButton.onclick = displayCourses


// Function to check if MetaMask is installed
async function connect() {

  if (typeof window.ethereum !== "undefined") {
    // MetaMask is installed
    try {
      // Request access to the user's MetaMask accounts
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      // if (accounts.length > 0) {
      //   isAddressConnected = true;
      //   alert(`Connected to Ethereum address: ${accounts[0]}`);
      //   // Change the button label to "Connected"
      //   document.getElementById("connectButton").textContent = "Connected";
      // }
      // Update the "Connected" button text
      connectButton.innerHTML = "Connected";

    } catch (error) {
      console.error(error);
    }
  } else {
    // MetaMask is not installed
    connectButton.innerHTML = "Please install MetaMask";
  }
}

async function addCourse() {

  console.log("Adding new course ...")
  // Retrieve values from the input fields
  const contentHash = document.getElementById("contentHash").value;
  const registrationFee = document.getElementById("registrationFee").value;
  const certificateMetadata = document.getElementById("certificateMetadata").value;

  // Validate the input data
  if (!contentHash || !registrationFee || !certificateMetadata) {
    alert("Please fill in all the required fields.");
    return;
  }
  if (isNaN(registrationFee) || parseFloat(registrationFee) <= 0) {
    alert("Registration fee must be a positive number.");
    return;
  }
  // Check if MetaMask is installed
  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);
    try {

      const fee = ethers.utils.parseEther(registrationFee)

      const transactionResponse = await contract.addCourse(
        contentHash,
        fee,
        certificateMetadata
      );
      // await listenForTransactionMine(transactionResponse, provider)

      transactionResponse.wait()
      console.log("Done!")

      // Add an event listener for the "CourseAdded" event
      contract.on("CourseAdded", (courseId, creator) => {
        // Display the event in the web page
        eventLog.innerHTML = `Event Log: Course ID: ${courseId}, Added by: ${creator}`;

      })

      // Clear input fields
      document.getElementById("contentHash").value = "";
      document.getElementById("registrationFee").value = "";
      document.getElementById("certificateMetadata").value = "";

    }
    catch (error) {
      console.error(error);
      alert("Failed to add a course. Please check the input values.");
    }
  }
  else {
    addCourseButton.innerHTML = "Please install MetaMask"
  }
}

// Function to display the list of courses
async function displayCourses() {
  if (typeof window.ethereum === "undefined") {
    alert("Please install MetaMask");
    return;
  }

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  const contract = new ethers.Contract(contractAddress, abi, signer);
  const delt_contract = new ethers.Contract(delt_contractAddress, delt_abi, signer);

  const courseListDiv = document.getElementById("courseList");

  // Clear the previous content
  courseListDiv.innerHTML = "";

  const coursesCount = await contract.getCoursesCount()

  for (let courseId = 0; courseId < coursesCount; courseId++) {
    const courseData = await contract.courses(courseId)

    const courseDiv = document.createElement("div");
    courseDiv.innerHTML = `
          <p>Course ID: ${courseId}</p>
          <p>Course Creator: ${courseData.creator}</p>
          <p>Certificate: ${courseData.certificateMetadata}</p>
          <p>Registration Fee: ${ethers.utils.formatEther(courseData.registrationBaseFee)} DeLT</p>
          <p>Content Hash on IPFS: ${courseData.encryptedContentHash}</p>
      `;

    const enrollButton = document.createElement("button");
    enrollButton.textContent = "Enroll in course";

    const getCertificateButton = document.createElement("button");
    getCertificateButton.textContent = "Get certificate";

    // Create an input box for the student to enter the token amount
    const tokenAmountInput = document.createElement("input");
    tokenAmountInput.type = "number";
    tokenAmountInput.placeholder = "You can pay more than course fee for contributing in matching pool";

    enrollButton.addEventListener("click", async () => {
      if (courseData.active) {
        // Get the token amount entered by the student
        const tokenAmount = tokenAmountInput.value;
        if (isNaN(tokenAmount)) {
          alert(`Please enter a valid token amount greater than or equal to ${courseData.registrationBaseFee}.`);
        }
        try {
          const parsedTokenAmount = ethers.utils.parseEther(tokenAmount)
          // Approve the contract to spend tokens
          const approvalTransaction = await delt_contract.approve(contractAddress, parsedTokenAmount);
          // Wait for approval transaction to be mined
          await approvalTransaction.wait();
          // Enroll in class
          const transactionResponse = await contract.enrollInCourse(courseId, parsedTokenAmount);
          await transactionResponse.wait();
          // Add an event listener for the "CourseEnrolled" event
          contract.on("CourseEnrolled", (courseId, studentAddress) => {
            // Display the event in the web page
            eventLog.innerHTML = `Event Log: Course ID: ${courseId}, Enrolled by: ${studentAddress}`;
          })
        } catch (error) {
          alert(`Contract Error: ${error.data.message}`)
          console.error(error);
          // alert("Failed to enroll in the course.");
        }
      } else {
        eventLog.innerHTML = "This course is not currently active."
      }
    })

    getCertificateButton.addEventListener("click", async () => {
      try {
        const transactionResponse = await contract.getCertificate(courseId);
        await transactionResponse.wait();

        // Add an event listener for the "CertificateIssued" event
        contract.on("CertificateIssued", (tokenId, student, courseId) => {
          // Display the event in the web page
          eventLog.innerHTML = `Event Log: Certificate with token ID: ${tokenId} 
            for Course ID: ${courseId}, 
            issued for: ${student}`;
        })
      } catch (error) {
        alert(`Contract Error: ${error.data.message}`)
        console.error(error);
        // alert("Failed to enroll in the course.");
      }
    })

    courseDiv.appendChild(getCertificateButton);
    courseDiv.appendChild(tokenAmountInput);
    courseDiv.appendChild(enrollButton);
    courseListDiv.appendChild(courseDiv);
  }
}

async function increaseMatchingPool() {

  console.log("Increasing matching pool ...")
  // Retrieve values from the input fields
  const tokenAmount = document.getElementById("tokenAmount").value;

  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);
    const delt_contract = new ethers.Contract(delt_contractAddress, delt_abi, signer);
    try {
      const amountToPool = ethers.utils.parseEther(tokenAmount)

      // Approve the contract to spend tokens
      const approvalTransaction = await delt_contract.approve(contractAddress, amountToPool);

      // Wait for approval transaction to be mined
      await approvalTransaction.wait();

      const transactionResponse = await contract.increaseMatchingPool(
        amountToPool
      );
      await listenForTransactionMine(transactionResponse, provider)
      console.log("Done!")
      // await transactionResponse.wait();

      // Add an event listener for the "MatchingPoolIncreased" event
      contract.on("MatchingPoolIncreased", (funderAddress, addedAmount) => {
        // Display the event in the web page
        const tokenAmount = ethers.utils.formatEther(addedAmount)
        eventLog.innerHTML = `Event Log: Address: ${funderAddress} increased matching pool with amount: ${tokenAmount} DeLT`;

      })

      // Clear input fields
      document.getElementById("tokenAmount").value = "";

    }
    catch (error) {
      console.error(error);
      alert("Failed to increase matching pool. Please check the input values.");
    }
  }
  else {
    addCourseButton.innerHTML = "Please install MetaMask"
  }
}

// This function will show current matching pool balance (contract balance)
async function showMatchingPool() {

  console.log("Fetching matching pool balance ...")
  // Retrieve values from the input fields

  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {

      const matchingPool = await contract.matchingPool()
      eventLog.innerHTML = `Matching pool balance: ${ethers.utils.formatEther(matchingPool)} DeLT`;

    }
    catch (error) {
      console.error(error);
      alert("Failed to increase matching pool. Please check the input values.");
    }
  }
  else {
    addCourseButton.innerHTML = "Please install MetaMask"
  }
}


function listenForTransactionMine(transactionResponse, provider) {
  console.log(`Mining ${transactionResponse.hash}`)
  return new Promise((resolve, reject) => {
    try {
      provider.once(transactionResponse.hash, (transactionReceipt) => {
        console.log(
          `Completed with ${transactionReceipt.confirmations} confirmations. `
        )
        resolve()
      })
    } catch (error) {
      reject(error)
    }
  })
}

const withdrawalEnabledStatus = document.getElementById("withdrawalEnabledStatus");
const withdrawFundsButton = document.getElementById("withdrawFundsButton");
const updateMatchingFundsButton = document.getElementById("updateMatchingFundsButton");
const toggleWithdrawFundsButton = document.getElementById("toggleWithdrawFundsButton");
const resetContributionsButton = document.getElementById("resetContributionsButton");
// const eventLog = document.getElementById("eventLog");

// Event listener for the Toggle Withdrawal button
toggleWithdrawFundsButton.addEventListener("click", async () => {
  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);
    try {
      // Call the toggleWithdrawFunds function on the contract
      const transactionResponse = await contract.toggleWithdrawFunds();
      await transactionResponse.wait();
      console.log("Toggle Withdrawal function completed!");

    } catch (error) {
      alert(error.data.message)
      console.error(error);
      // alert("Failed to toggle withdrawal. Please check the contract or try again.");
    }
  } else {
    toggleWithdrawFundsButton.innerHTML = "Please install MetaMask"
  }

});

// Event listener for the Reset Contributions button
resetContributionsButton.addEventListener("click", async () => {
  const provider = new ethers.providers.Web3Provider(window.ethereum)
  const signer = provider.getSigner();
  const contract = new ethers.Contract(contractAddress, abi, signer);
  try {
    alert("You are reseting the contributions!")
    // Call the resetContributions function on the contract
    const transactionResponse = await contract.resetContributions();
    await transactionResponse.wait();
    console.log("Reset Contributions function completed!");

  } catch (error) {
    alert(error.data.message)
    console.error(error);
    alert("Failed to reset contributions.");
  }
});

// Event listener for the Update Matching Funds button
updateMatchingFundsButton.addEventListener("click", async () => {
  const provider = new ethers.providers.Web3Provider(window.ethereum)
  const signer = provider.getSigner();
  const contract = new ethers.Contract(contractAddress, abi, signer);
  try {
    // Call the updateMatchingFunds function on the contract
    const transactionResponse = await contract.updateMatchingFunds();
    await transactionResponse.wait();
    console.log("Update Matching Funds function completed!");

  } catch (error) {
    alert(error.data.message)
    console.error(error);
    alert("Failed to update matching funds.");
  }
});

// Event listener for the Withdraw Funds button
withdrawFundsButton.addEventListener("click", async () => {
  const provider = new ethers.providers.Web3Provider(window.ethereum)
  const signer = provider.getSigner();
  const contract = new ethers.Contract(contractAddress, abi, signer);
  const delt_contract = new ethers.Contract(delt_contractAddress, delt_abi, signer);

  try {
    const amountToWithdraw = delt_contract.balanceOf(contractAddress);

    // Call the withdrawFunds function on the contract
    const transactionResponse = await contract.withdrawFunds(amountToWithdraw);
    await transactionResponse.wait();
    console.log("Withdraw Funds function completed!");

  } catch (error) {
    alert(error.data.message)
    console.error(error);
    alert("Failed to withdraw funds.");
  }
});



// Event listener for the "Withdraw Matching Fund" button
const withdrawMatchingFundButton = document.getElementById('withdrawMatchingFundButton');
withdrawMatchingFundButton.addEventListener('click', withdrawMatchingFund);

// Event listener for the "Withdraw Matching Fund" button
const showMatchingFundButton = document.getElementById('showMatchingFundButton');
showMatchingFundButton.addEventListener('click', showMatchingFund);


// Function to withdraw matching funds
async function withdrawMatchingFund() {
  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    // Retrieve the project ID entered by the user
    const projectIdInput = document.getElementById("projectId");
    const projectId = projectIdInput.value;

    try {
      // Call the contract's withdrawMatchingFund function with the projectId
      const transactionResponse = await contract.withdrawMatchingFund(projectId);

      // Wait for the transaction to be confirmed
      await transactionResponse.wait();

      contract.on("MatchingFundWithdrawn", (projectId, creator) => {
        // This code will execute when the "MatchingFundWithdrawn" event is emitted
        eventLog.innerHTML = `MatchingFundWithdrawn Event: Project ID ${projectId}, Withdrawn by ${creator}`
      })

      // Update withdrawal status after successful withdrawal
      displayWithdrawalStatus();
      console.log('Matching funds withdrawn successfully');
    } catch (error) {
      alert(error.data.message)
      console.error(error);
      alert('Failed to withdraw matching funds for the project.');
    }
  } else {
    console.log('Please install MetaMask');
  }
}

async function showMatchingFund() {
  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    // Retrieve the project ID entered by the user
    const projectIdInput = document.getElementById("projectId");
    const projectId = projectIdInput.value;

    try {
      // Call the contract's withdrawMatchingFund function with the projectId
      const project = await contract.projects(projectId);
      const matchingFund = ethers.utils.formatUnits(project.matchingFund, "ether");

      // const matchingFund = await ethers.utils.parseEther(project.matchingFund)
      console.log(matchingFund)
      document.getElementById("matchingFundAmount").innerHTML = `Matching fund amount is: ${matchingFund} DeLT`

    } catch (error) {
      // alert(error.data.message)
      console.error(error);
      alert('Failed to show matching funds of the project.');
    }
  } else {
    console.log('Please install MetaMask');
  }
}


// Function to retrieve Withdrawal Enabled status from the contract
async function getWithdrawalEnabledStatus() {
  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {
      const isEnabled = await contract.withdrawalEnabled()
      console.log(isEnabled)
      if (isEnabled) {
        document.getElementById("withdrawalEnabledStatus").textContent = "Withdrawal Enabled: Yes"
      }
      else {
        document.getElementById("withdrawalEnabledStatus").textContent = "Withdrawal Enabled: No"
      }
    } catch (error) {
      console.error(error);
      alert('Failed to retrieve Withdrawal Enabled status.');
    }
  } else {
    console.log('Please install MetaMask');
  }
}

// Function to retrieve Withdrawal Deadline from the contract
async function getWithdrawalDeadline() {
  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {
      // const deadline = await contract.withdrawalDeadline();
      const startTime = await contract.withdrawalStartTime();
      if (startTime == 0) {

        document.getElementById("withdrawalDeadlineStatus").textContent = "Withdrawal Deadline: Not set"
      } else {
        document.getElementById("withdrawalDeadlineStatus").textContent = "Withdrawal Deadline: 7 days"
      }

    } catch (error) {
      console.error(error);
      alert('Failed to retrieve Withdrawal Deadline.');
    }
  } else {
    console.log('Please install MetaMask');
  }
}

// Function to retrieve Pending Withdrawals from the contract
async function getPendingWithdrawals() {
  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {
      const pending = await contract.pendingWithdrawals();
      document.getElementById("pendingWithdrawalsStatus").textContent = `Pending Withdrawals: ${pending}`;
    } catch (error) {
      console.error(error);
      alert('Failed to retrieve Pending Withdrawals.');
    }
  } else {
    console.log('Please install MetaMask');
  }
}

// Attach click event listeners to the buttons
document.getElementById("withdrawalEnabledButton").addEventListener("click", getWithdrawalEnabledStatus);
document.getElementById("withdrawalDeadlineButton").addEventListener("click", getWithdrawalDeadline);
document.getElementById("pendingWithdrawalsButton").addEventListener("click", getPendingWithdrawals);


// Function to display the student's certificates when clicking the "My certificates" button
async function showMyCertificates() {
  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {
      const studentAddress = await signer.getAddress();
      const studentCertificates = await contract.getAddressToCertificates(studentAddress);

      // Clear the previous certificates
      const myCertificatesDiv = document.getElementById("myCertificates");
      myCertificatesDiv.innerHTML = '';

      if (studentCertificates.length === 0) {
        myCertificatesDiv.textContent = "You don't have any certificates yet.";
      } else {
        const certificatesList = document.createElement('ul');
        certificatesList.className = "certificates-list";

        for (const tokenId of studentCertificates) {
          const tokenMetadata = await contract.tokensMetadata(tokenId);

          const certificateItem = document.createElement('li');
          certificateItem.textContent = `Token ID: ${tokenId}, Metadata: ${tokenMetadata}`;
          certificatesList.appendChild(certificateItem);
        }

        myCertificatesDiv.appendChild(certificatesList);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to retrieve certificates.');
    }
  } else {
    console.log('Please install MetaMask');
  }
}

// Attach a click event listener to the "myCertificatesButton"
document.getElementById("myCertificatesButton").addEventListener("click", showMyCertificates);

async function showStudentStatus() {
  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    // Retrieve values from the input fields (course ID and student address)
    const courseIdInput = document.getElementById("courseId");
    const studentAddressInput = document.getElementById("studentAddress");

    const courseId = courseIdInput.value;
    const studentAddress = studentAddressInput.value;

    try {
      // Call the contract's studentStatus function to get the student's status
      const studentStatus = await contract.studentStatus(studentAddress, courseId);

        let status
      if (studentStatus == 0)
        status = "Not enrolled"
      else if (studentStatus == 1)
        status = "Enrolled"
      else if (studentStatus == 2)
        status = "Passed"
      else if (studentStatus == 3)
        status = "Certified"

      // Display the student status in the web page
      // const eventLog = document.getElementById("eventLog");
      eventLog.innerHTML = `Student address: ${studentAddress}, Course ID: ${courseId}, Status: ` + status;
      console.log("Student status retrieved successfully.");
    } catch (error) {
      alert(error.data.message)
      console.error(error);
      alert('Failed to retrieve student status.');
    }
  } else {
    console.log('Please install MetaMask');
  }
}

// Attach a click event listener to the "showStatusButton"
document.getElementById("showStatusButton").addEventListener("click", showStudentStatus);



async function updatePassedCourse() {
  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    // Retrieve values from the input fields (course ID and student address)
    const courseIdInput = document.getElementById("courseId");
    const studentAddressInput = document.getElementById("studentAddress");

    const courseId = courseIdInput.value;
    const studentAddress = studentAddressInput.value;

    try {
      // Call the contract's updatePassedCourses function
      const transactionResponse = await contract.updatePassedCourses(courseId, studentAddress);

      // Wait for the transaction to be mined
      await transactionResponse.wait();

      // Display the event in the web page
      const eventLog = document.getElementById("eventLog");
      eventLog.innerHTML = `Event Log: CoursePassed - Course ID: ${courseId}, Student: ${studentAddress}`;
      console.log("Student's course status updated to PASSED successfully.");
    } catch (error) {
      alert(error.data.message)

      console.error(error);
      alert('Failed to update the course status.');
    }
  } else {
    console.log('Please install MetaMask');
  }
}

// Attach a click event listener to the "updatePassedButton"
document.getElementById("updatePassedButton").addEventListener("click", updatePassedCourse);


async function issueCertificate() {
  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    // Retrieve values from the input fields (course ID and student address)
    const courseIdInput = document.getElementById("courseId");
    const studentAddressInput = document.getElementById("studentAddress");

    const courseId = courseIdInput.value;
    const studentAddress = studentAddressInput.value;

    try {
      // Call the contract's issueCertificate function
      const transactionResponse = await contract.issueCertificate(courseId, studentAddress);

      // Wait for the transaction to be mined
      await transactionResponse.wait();

      // Display the event in the web page
      const eventLog = document.getElementById("eventLog");
      eventLog.innerHTML = `Event Log: CertificateIssued - Course ID: ${courseId}, Student: ${studentAddress}`;
      console.log("Certificate issued successfully.");
    } catch (error) {
      alert(error.data.message)
      console.error(error);
      alert('Failed to issue the certificate.');
    }
  } else {
    console.log('Please install MetaMask');
  }
}

// Attach a click event listener to the "issueCertificateButton"
document.getElementById("issueCertificateButton").addEventListener("click", issueCertificate);
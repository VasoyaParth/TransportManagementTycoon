// Staff candidate pools — SRS §7.3. Names are explicitly gendered so the
// avatar icon always matches (FR-7.4). `m` = male, `f` = female.
export const STAFF_NAMES = {
  m: ['Rajesh Kumar', 'Amit Sharma', 'Suresh Patel', 'Vikram Singh', 'Manoj Yadav',
      'Arjun Reddy', 'Karthik Iyer', 'Sandeep Verma', 'Ravi Nair', 'Deepak Joshi',
      'Harpreet Gill', 'Imran Sheikh', 'Ganesh Rao', 'Prakash Das', 'Nitin Chauhan',
      'Abhishek Mishra', 'Rohit Pillai', 'Farhan Ansari', 'Balwinder Sandhu', 'Mahesh Gowda',
      'Ajay Devgan', 'Rakesh Tiwari', 'Sunil Bhosale', 'Vijay Naidu', 'Anil Kapoor',
      'Yogesh Shetty', 'Dinesh Kambli', 'Naveen Rathore', 'Pramod Jadhav', 'Kishore Menon',
      'Satish Kulkarni', 'Ramesh Choudhary', 'Vinod Pandey', 'Ashok Bhatt', 'Girish Hegde',
      'Tarun Malviya', 'Devender Rana', 'Mukesh Agarwal', 'Sohail Qureshi', 'Jaswant Bedi',
      'Praveen Kumar', 'Santosh More', 'Bhaskar Reddy', 'Uday Kotian', 'Zubair Ahmed',
      'Lokesh Gupta', 'Chetan Bhagat', 'Nikhil Saxena', 'Pankaj Tripathi', 'Ravindra Vora'],
  f: ['Priya Sharma', 'Anjali Mehta', 'Sunita Devi', 'Kavita Reddy', 'Neha Gupta',
      'Lakshmi Menon', 'Pooja Patil', 'Divya Krishnan', 'Ritu Malhotra', 'Sneha Kulkarni',
      'Fatima Khan', 'Gurpreet Kaur', 'Ananya Bose', 'Meera Pillai', 'Swati Deshmukh',
      'Rekha Nair', 'Shweta Jain', 'Aarti Chauhan', 'Nandini Rao', 'Preeti Singh',
      'Vaishali Patil', 'Sana Sheikh', 'Manisha Koirala', 'Deepika Iyer', 'Komal Verma',
      'Radhika Menon', 'Jyoti Yadav', 'Simran Kaur', 'Bhavana Reddy', 'Tanvi Desai',
      'Nisha Agarwal', 'Payal Gupta', 'Ishita Bose', 'Sarita Devi', 'Anushka Joshi',
      'Kajal Pillai', 'Rupali Deshmukh', 'Farida Khan', 'Geeta Rathore', 'Madhuri Kulkarni'],
};

export const STAFF_ROLES = [
  { id: 'driver', name: 'Driver', icon: 'steering' },
  { id: 'mechanic', name: 'Mechanic', icon: 'wrench' },
  // Managers are disabled for now — no gameplay effect yet. Uncomment (and the
  // matching spots in gameStore.randomCandidates + tabs.js StaffTab) when a
  // real use for managers is designed.
  // { id: 'manager', name: 'Manager', icon: 'briefcase-account' },
];

// Monthly salary and skill ranges per level (SRS §7.3)
export const STAFF_LEVELS = [
  { id: 'junior', name: 'Junior', salary: [20000, 30000], skill: [25, 40] },
  { id: 'senior', name: 'Senior', salary: [35000, 55000], skill: [55, 70] },
  { id: 'expert', name: 'Expert', salary: [55000, 90000], skill: [85, 99] },
];

// Avatar icon per role+gender (MaterialCommunityIcons)
export const STAFF_AVATAR = {
  'driver:m': 'account-tie-hat', 'driver:f': 'face-woman-shimmer-outline',
  'mechanic:m': 'account-hard-hat', 'mechanic:f': 'account-hard-hat-outline',
  'manager:m': 'account-tie', 'manager:f': 'account-tie-woman',
};

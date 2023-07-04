document.getElementById("clearSelection").addEventListener("click", function() {
    document.getElementById("emailreq").value = ""; 
  });
  var bcclink = document.getElementById("bcclink");
  var bccsection = document.getElementById("bccsection");
​
  bcclink.addEventListener("click", function() {
    if (bccsection.style.display === "none") {
      bccsection.style.display = "block"; // Show the Bcc section
    } else {
      bccsection.style.display = "none"; // Hide the Bcc section
    }
  });
 
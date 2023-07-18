// for the add details section 
const facebookSection = document.getElementById('facebooksection');
const twitterSection = document.getElementById('twittersection');
const addDetailsContainer = document.getElementById('addDetailsLink');
  
  facebookSection.style.display = 'none';
  twitterSection.style.display = 'none';
  
  const addDetailsLink = document.getElementById('addDetailsLink');
  addDetailsLink.addEventListener('click', function(event) {
    event.preventDefault();
  
    if (facebookSection.style.display === 'none') {
      facebookSection.style.display = 'block';
      twitterSection.style.display = 'block';
      addDetailsContainer.style.display = 'none';
    } else {
      facebookSection.style.display = 'none';
      twitterSection.style.display = 'none';
    }
  });

  // for the add button section
const popover = new bootstrap.Popover('.popover-dismiss', {
  trigger: 'focus'
})

const lineItemTable = document.getElementById('lineItemTable');
const addLineButton = document.getElementById('addLineButton');
addLineButton.addEventListener('click', (event)=> {
    event.preventDefault();
    const lastRow = lineItemTable.querySelector('.line-item.new-line-item');
    const newRow = lastRow.cloneNode(true);
    const inputFields = newRow.querySelectorAll('input');
    
    inputFields.forEach(function(input) {
      input.value = '';
    });

    const tableBody = lineItemTable.querySelector('.line-item-body');
    tableBody.appendChild(newRow);
});
  
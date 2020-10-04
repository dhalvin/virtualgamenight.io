window.addEventListener("DOMContentLoaded", function(){
    var backPlate = document.createElement('div');
    /*var sub = document.createElement('div');
    sub.classList.add('labelHandle');
    backPlate.appendChild(sub);*/
    backPlate.classList.add('draggableHeader');
    document.body.appendChild(backPlate);
    Draggable.create(backPlate, {dragResistance: 1,
        onClick: function(e){
            if(e.pointerType == "touch" && this.lastPress && e.timeStamp - this.lastPress > 1000){
                alert("Long press detected");
            }
            else if(e.which == 1){
                alert("Normal press detected");
            }
            else if(e.which == 3){
                alert("Right click detected");
            }
            this.lastPress = null;
            console.log(e);
        },
        onPress: function(e){
            this.lastPress = e.timeStamp;
        }
    });

    var backPlate_2 = document.createElement('div');
    backPlate_2.classList.add('draggableHeader_2');
    document.body.appendChild(backPlate_2);
    backPlate_2.appendChild(backPlate);
    Draggable.create(backPlate_2, {
        onClick: function(e){
            if(e.pointerType == "touch" && this.lastPress && e.timeStamp - this.lastPress > 1000){
                alert("Long press detected");
            }
            else if(e.which == 1){
                gsap.to(backPlate, {x: 200, y: 200, duration: 5, onStart: function(){
                    Draggable.get(backPlate).disable();
                }, onComplete: function(){
                    Draggable.get(backPlate).enable();
                }});
            }
            else if(e.which == 3){
                alert("Right click detected");
            }
            this.lastPress = null;
            console.log(e);
        },
        onPress: function(e){
            this.lastPress = e.timeStamp;
        }
    });
});
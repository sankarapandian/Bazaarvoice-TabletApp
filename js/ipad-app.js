/*
Function to turn our API response into something a little more friendly for use in Javascript Template languages.
It recreates some of the heirarchy, handles a couple Null values for display, and makes a rating percent to use for stars.
*/

(function(){
    this.make_results = function make_results(json) {
        var new_results = {Results: []};
        // Should work in every browser we care about
        for(var r = 0; r < json.Results.length; r++) {
            var obj = json.Data[json.Results[r].Type][json.Results[r].ID];
            new_results.Results.push(this.expand_objects(obj, json));         
        }
        return new_results;
    };
    this.expand_objects = function expand_objects(obj, json) {
        for (var key in obj) {
            if (key == "AuthorID") {
                obj['Author'] = json.Data.Author[obj[key]];
                if(obj['Author'] && 'DisplayName' in obj['Author']) {
                    obj['Author_DisplayName'] = json.Data.Author[obj[key]]['DisplayName'];
                } else {
                    obj['Author_DisplayName'] = "Anonymous";
                }
            }
            if (key == "ProductID") {
                obj['Product'] = this.expand_objects(json.Data.Product[obj[key]], json);
            }
            if (key == "CategoryID") {
                obj['Category'] = this.expand_objects(json.Data.Category[obj[key]], json);
            }
            if (key == "AverageRating" || key == "Rating") {
                obj["RatingPercent"] = 100 * obj[key] / 5;
            }
        }
        return obj;
    }
})();

/*
Now the actual Sencha touch Stuff.
*/
Ext.setup({
    tabletStartupScreen: 'img/tablet_startup.png',
    phoneStartupScreen: 'img/phone_startup.png',
    icon: 'img/icon.png',
    glossOnIcon: true,

    onReady: function() {
        
        var key = "YOUR_API_KEY";
        var current_brand = {name: 'YOUR_COMPANY_NAME'}; 
        
        var productData = new Ext.data.Store({
            id: 'productData', 
            proxy: {
                type: 'memory'
            },
            fields: ['ID', 'Name', 'Picture', 'RatingPercent', 'ReviewCount', 'Description']
        });
        
        var reviewData = new Ext.data.Store({
            id: 'reviewData', 
            proxy: {
                type: 'memory'
            },
            fields: ['Title', 'RatingPercent', 'Text', 'Author_DisplayName']
        });

        var bazaarvoiceLogo = new Ext.Component({
            id: 'bazaarvoiceLogo',
            title: 'Logo',
            cls: 'logo',
            html: "<img height=30px class='logo' src='img/labs.png'/>",
            dock: 'bottom'

        });

        var productDisplay = new Ext.DataView({
            id: 'products',
            title: 'Products',
            store: productData,
            scroll: 'vertical',
            tpl: Ext.XTemplate.from('product'),
            itemSelector: 'div.product',
            styleHtmlContent: true
        });
   
        var singleClientPanel = new Ext.Component({
            cls: 'single_client_panel',
            height: 100
        });
        
        var productPanel = new Ext.Panel({
            layout: 'fit',
            dockedItems: [singleClientPanel],
            items: [productDisplay]
        });        
             
        var frontPanel = new Ext.Panel({
            id: 'frontPanel',
            layout: 'fit',
            items: [productPanel],
            dockedItems: [bazaarvoiceLogo]
            
        });
   
        var singleProductPanel = new Ext.Component({
            cls: 'productPanel',
            height: 225
        });
   
        var reviewDisplay = new Ext.DataView({
            id: 'reviews',
            title: 'Reviews',
            cls: 'reviews',
            store: reviewData,
            scroll: 'vertical',
            tpl: Ext.XTemplate.from('review'),
            itemSelector: 'div.review',
            styleHtmlContent: true
        });

        var reviewPanel = new Ext.Panel({
            layout: 'fit',
            dockedItems: [singleProductPanel],
            items: [reviewDisplay]
        });

        function onUiBack() {
            if(panel.getActiveItem() == reviewPanel) {
                changeToProducts(true);
            } else if (panel.getActiveItem() == productPanel) {
                changeToBrands();
            }
        }
        
        var backButton = new Ext.Button({
            text: 'Back',
            ui: 'back',
            hidden: true,
            handler: onUiBack
        });
        
        var topToolbar = new Ext.Toolbar({
            dock : 'top',
            items: [backButton]
        });
   
        var panel = new Ext.Panel({
            fullscreen: true,
            layout: 'card',
            id: 'content',
            items: [frontPanel, productPanel, reviewPanel],
            dockedItems: [topToolbar]
        });
                
        var loadProducts = function(key) {
            productDisplay.store.loadData([]);            
            panel.setLoading(true);
            Ext.util.JSONP.request({
                url: 'http://api.bazaarvoice.com/api/product.json',
                callbackKey: 'callback',
                params: {                    
                    key: key,
                    limit: 20
                },
                callback: function(result) {
                    productDisplay.store.loadData(make_results(result).Results);
                    productDisplay.scroller.moveTo(0,150);
                    productDisplay.doComponentLayout();
                    panel.setLoading(false);
                }
            });
        }
        
        var loadReviews = function(key, productid) {
            reviewDisplay.store.data.clear();
            panel.setLoading(true);
            Ext.util.JSONP.request({
                url: 'http://api.bazaarvoice.com/api/review.json',
                callbackKey: 'callback',
                params: {                    
                    key: key,
                    productid: productid,
                    limit: 20
                },
                callback: function(result) {
                    reviewDisplay.store.loadData(make_results(result).Results);
                    reviewDisplay.scroller.moveTo(0,260);
                    reviewDisplay.doComponentLayout();
                    panel.setLoading(false);
                }
            });
        }
        
        function changeToProducts(goingBack) {
            backButton.hide();            
            topToolbar.setTitle("iPad Reviews");            
            var tpl = Ext.XTemplate.from('single_brand_template');
            var html = tpl.applyTemplate(current_brand);
            singleClientPanel.update(html);
            panel.setActiveItem(productPanel);
            if (!goingBack) {
                loadProducts(key);                
            }
        }
        
        function changeToReviews(product) {
            var tpl = Ext.XTemplate.from('single_product_template');
            var html = tpl.applyTemplate(product.data);
            singleProductPanel.update(html);
            
            topToolbar.setTitle("Recent Reviews");
            backButton.show();
            panel.setActiveItem(reviewPanel);
            loadReviews(key, product.get('ID'));
        }

        productDisplay.on('itemtap', function(view, index, el, e) {
            var ds = view.getStore(),
                r  = ds.getAt(index);

            changeToReviews(r);
            
        });

        changeToProducts();

    }
});


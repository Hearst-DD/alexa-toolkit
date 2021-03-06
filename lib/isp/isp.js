"use strict";

/**
 * LIST_API HANDLERS
 *
 * Handles adding items to the Alexa Shopping and To-do Lists
 *
 */
const analytics = require( "./../analytics/analytics" ),
    c = require( "./../constants" ),
    e = require( "./../enums" ),
    err = require( "./../errors" ),
    responseBuilder = require( "./../response/response" ).builder,
    utils = require( "./../utils/utils" );

/**
 *  Util Methods
 */
const ispApiUtils = function() {
    return {
        getAllConsumableProducts: ( inSkillProductList ) => {
            const consumableProductList = inSkillProductList.filter( record => record.type === e.ISP.PRODUCT.TYPE.CONSUMABLE );

            return consumableProductList;
        },

        getAllEntitledProducts: ( inSkillProductList ) => {
            const entitledProductList = inSkillProductList.filter( record => record.entitled === e.ISP.PRODUCT.ENTITLED.ENTITLED );

            return entitledProductList;
        },

        getAllPurchasableProducts: ( inSkillProductList ) => {
            const entitledProductList = inSkillProductList.filter( record => record.purchasable === e.ISP.PRODUCT.PURCHASABLE.PURCHASABLE );

            return entitledProductList;
        },

        getSpeakableListOfProducts: ( entitleProductsList ) => {
            const productNameList = entitleProductsList.map( item => item.name );

            let productListSpeech = productNameList.join( ', ' ); // Generate a single string with comma separated product names

            productListSpeech = productListSpeech.replace( /,([^,]*)$/, ' and $1' ); // Replace last comma with an 'and '

            return productListSpeech;
        },

        /**
         * UTILS
         */
        isEntitled: ( product ) => {
            return isProduct( product ) &&
                product[0].entitled === e.ISP.PRODUCT.ENTITLED.ENTITLED;
        },

        isProduct: ( product ) => {
            return product &&
                product.length > 0;
        },

        isPurchasable: ( product ) => {
            return isProduct( product ) &&
                product[0].entitled === e.ISP.PRODUCT.PURCHASABLE.PURCHASABLE;
        },

        sendError: ( responseCode, msg ) => {
            console.error( "[ISP ERROR] " + (responseCode || "") + ": " + (msg || "") );

            return Promise.reject( new Error( responseCode || err.code.UNKNOWN + ": " + msg || "" ) );
        }
    }
}();

const ispApi = {
    getConsumableProducts: async ( handlerInput ) => {
        const products = await ispApi.getInSkillProducts( handlerInput );

        return ispApiUtils.getAllConsumableProducts( products.inSkillProducts );
    },

    getEntitledProducts: async ( handlerInput ) => {
        const products = await ispApi.getInSkillProducts( handlerInput );

        return ispApiUtils.getAllEntitledProducts( products.inSkillProducts );
    },

    getInSkillProducts: async ( handlerInput ) => {
        const locale = utils.getLocale( handlerInput ),
            ms = handlerInput.serviceClientFactory.getMonetizationServiceClient();

        try {
            return ms.getInSkillProducts( locale );
        } catch( error ) {
            console.error( "getInSkillProducts Error", error );

            return ispApiUtils.sendError( err.code.BAD_REQUEST, err.msg.API_ERROR );
        }
    },

    getProductById: ( productId, products ) => {
        return products.inSkillProducts.filter( record => record.productId === productId );
    },

    getProductByReferenceName: ( productName, products ) => {
        return products.inSkillProducts.filter(record => record.referenceName === productName);
    },

    getPurchasableProducts: async ( handlerInput ) => {
        const products = await ispApi.getInSkillProducts( handlerInput );

        return ispApiUtils.getAllPurchasableProducts( products.inSkillProducts );
    },

    getSpeakableEntitledProducts: async ( handlerInput ) => {
        return ispApiUtils.getSpeakableListOfProducts( await ispApi.getEntitledProducts( handlerInput ) );
    },

    purchaseById: async ( handlerInput, productId ) => {
        if ( productId ) {
            const payload = {
                InSkillProduct: {
                    productId: productId,
                }
            };

            return responseBuilder.sendDirective( handlerInput, {
                type: e.DIRECTIVE.CONNECTIONS.SEND,
                name: e.ISP.DIRECTIVE.NAME.BUY,
                payload: payload,
                token: e.ISP.DIRECTIVE.TOKEN
            } );
        } else {
            return ispApiUtils.sendError( err.code.NOT_FOUND, err.msg.ISP.NO_PRODUCT );
        }
    },

    purchaseByName: async ( handlerInput, productName ) => {
        const products = await ispApi.getInSkillProducts( handlerInput );

        const product = ispApi.getProductByReferenceName( productName, products );

        return ispApi.purchaseProduct( handlerInput, product );
    },

    purchaseProduct: async ( handlerInput, product ) => {
        // take first product from array
        if ( Array.isArray( product ) && product.length > 0 ) {
            product = product[ 0 ];
        }

        if ( product && product.productId ) {
            return ispApi.purchaseById( handlerInput, product.productId );
        } else {
            return ispApiUtils.sendError( err.code.NOT_FOUND, err.msg.ISP.NO_PRODUCT );
        }
    },

    refundProductById: ( handlerInput, productId ) => {
        if ( productId ) {
            const payload = {
                InSkillProduct: {
                    productId: productId,
                }
            };

            return responseBuilder.sendDirective( handlerInput, {
                type: e.DIRECTIVE.CONNECTIONS.SEND,
                name: e.ISP.DIRECTIVE.NAME.CANCEL,
                payload: payload,
                token: e.ISP.DIRECTIVE.TOKEN
            } );
        } else {
            return ispApiUtils.sendError( err.code.NOT_FOUND, err.msg.ISP.NO_PRODUCT );
        }
    },

    refundProduct: async ( handlerInput, product ) => {
        // take first product from array
        if ( Array.isArray( product ) && product.length > 0 ) {
            product = product[ 0 ];
        }

        if ( product && product.productId ) {
            return ispApi.refundProductById( handlerInput, product.productId );
        } else {
            return ispApiUtils.sendError( err.code.NOT_FOUND, err.msg.ISP.NO_PRODUCT );
        }
    },

    /**
     * Sends a permission card.
     *
     * @param speechOutput
     * @param reprompt
     */
    sendPermissionCard: async ( handlerInput, outputData, options ) => {
        if ( outputData ) {
            try {
                await analytics.sendEvent( handlerInput, EVENTS.SEND_PERMISSION_CARD, { type: EVENTS.TYPE } );
            } catch ( error ) {
                console.error( "List permissions analytics error: ", error );
            }

            return responseBuilder.askForPermissions( handlerInput, outputData, options, c.PERMISSIONS.LIST );
        } else {
            return responseBuilder.ask( handlerInput, {
                speech: {
                    output: err.msg.CONTINUE,
                    reprompt: err.msg.CONTINUE
                }
            } );
        }
    },

    upsellById: async ( handlerInput, productId, message ) => {
        if ( productId ) {
            const payload = {
                InSkillProduct: {
                    productId: productId,
                },
                upsellMessage: message
            };

            return handlerInput.responseBuilder.addDirective( {
                type:  e.DIRECTIVE.CONNECTIONS.SEND,
                name: e.ISP.DIRECTIVE.NAME.UPSELL,
                payload: payload,
                token: e.ISP.DIRECTIVE.TOKEN,
            } );
        } else {
            return ispApiUtils.sendError( err.code.NOT_FOUND, err.msg.ISP.NO_PRODUCT );
        }
    },

    upsellProduct: async ( handlerInput, product, message ) => {
        // take first product from array
        if ( Array.isArray( product ) && product.length > 0 ) {
            product = product[ 0 ];
        }

        if ( product && product.productId ) {
            return ispApi.upsellById( handlerInput, product.productId, message );
        } else {
            return ispApiUtils.sendError( err.code.NOT_FOUND, err.msg.ISP.NO_PRODUCT );
        }
    }
};

module.exports = ispApi;

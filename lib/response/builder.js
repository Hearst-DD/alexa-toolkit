"use strict";

/**
 * RESPONSE BUILDERS
 *
 * Check README for usage.
 *
 */

const e = require( "./../enums" ),
    persistence = require( "./../persistence/persistence" ),
    responseUtils = require( "./utils" ),
    utils = require( "./../utils/utils" );


const builder = function() {
    return {
        ask: async ( handlerInput, data, options ) => {
            data = data || {};

            data.speech = responseUtils.buildSsml( data );

            handlerInput.responseBuilder
                .speak( data.speech.output )
                .reprompt( data.speech.reprompt );

            return builder.finalizeResponse( handlerInput, data, options );
        },

        askForPermissions: async ( handlerInput, data, options, permissions ) => {
            data = data || {};

            data.speech = responseUtils.buildSsml( data );

            handlerInput.responseBuilder
            .speak( data.speech.output )
            .withAskForPermissionsConsentCard( permissions );

            if ( data.speech.reprompt ) {
                handlerInput.responseBuilder.reprompt( data.speech.reprompt );
            }

            return builder.finalizeResponse( handlerInput, data, options );
        },

        finalizeResponse: async ( handlerInput, data, options ) => {
            if ( data ) {
                responseUtils.setRepeatSpeech( handlerInput, data, options );

                const hasAPL = utils.hasAPLInterface( handlerInput );

                if ( data.card && data.card.title && data.card.output && !hasAPL ) {
                    //TODO: part of else if as workaround
                    //Don't use card and Alexa.Presentation.APL.RenderDocument in the same skill response. Eventually, the APL document will get precedence.
                    const cardImg = utils.get( "card.image", data, null );

                    if ( cardImg ) {
                        handlerInput.responseBuilder.withStandardCard(
                            data.card.title,
                            data.card.output,
                            utils.makeImagePath( utils.get( e.cardImageUrl.small, imgObj, null ) ),
                            utils.makeImagePath( utils.get( e.cardImageUrl.large, imgObj, null ) )
                        )
                    } else {
                        handlerInput.responseBuilder.withSimpleCard(
                            data.card.title,
                            data.card.output
                        )
                    }
                }

                if ( hasAPL ) {
                    const template = await responseUtils.buildAplRenderDocumentDirective( handlerInput, utils.get( "apl", data, null ), options );

                    if ( template ) {
                        handlerInput.responseBuilder.addDirective( template );
                    }

                    const commands = await responseUtils.buildAplCommandDirective( handlerInput, utils.get( "aplCommands", data, null ), options );

                    if ( commands ) {
                        handlerInput.responseBuilder.addDirective( commands );
                    }
                } else if ( utils.hasDisplayInterface( handlerInput ) ) {
                    const template = responseUtils.buildDisplayTemplate( handlerInput, utils.get( "display", data, null ) );

                    if ( template ) {
                        handlerInput.responseBuilder.addRenderTemplateDirective( template );
                    }

                    //Hint
                    const hint = utils.get( "hint", data );
                    if ( hint ) {
                        handlerInput.responseBuilder.addHintDirective( hint );
                    }
                }
            }

            if ( options ) {
                if ( options.outgoingIntent ) {
                    persistence.setRequestAttributes( handlerInput, {
                        outgoingIntent: JSON.stringify( options.outgoingIntent )
                    } );
                }

                if ( options.shouldEndSession === true ) {
                    handlerInput.responseBuilder.withShouldEndSession( true );
                }
            }

            const responseObj = handlerInput.responseBuilder.getResponse();

            if ( process.env.LOG_RESPONSE === true || process.env.LOG_RESPONSE === "true" ) {
                console.log( ">>>>>> RESPONSE <<<<<< ", JSON.stringify( responseObj ) );
            }

            return responseObj;
        },

        sendDirective: async ( handlerInput, directive ) => {
            if ( utils.isObject( directive ) ) {
                handlerInput.responseBuilder.addDirective( directive );
            }

            return builder.finalizeResponse( handlerInput, null, null );
        },

        sendLinkAccountCard: async ( handlerInput, data, options ) => {
            data = data || {};

            data.speech = responseUtils.buildSsml( data );

            handlerInput.responseBuilder
            .speak( data.speech.output )
            .withLinkAccountCard();

            if ( data.speech.reprompt ) {
                handlerInput.responseBuilder.reprompt( data.speech.reprompt );
            }

            return builder.finalizeResponse( handlerInput, data, options );
        },

        tell: async ( handlerInput, data, options  ) => {
            data = data || {};

            data.speech = responseUtils.buildSsml( data );

            handlerInput.responseBuilder.speak( data.speech.output )
            .withShouldEndSession( true );

            return builder.finalizeResponse( handlerInput, data, options );
        }
    };
}();

module.exports = builder;
